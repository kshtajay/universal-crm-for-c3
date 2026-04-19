import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Runs every 5 minutes via Supabase cron (pg_cron).
// Processes: delayed automation actions, weather warnings (48h lookahead),
// maintenance_due triggers.
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const results = await Promise.allSettled([
    processDelayedJobs(),
    processWeatherWarnings(),
    processMaintenanceDue(),
  ])

  const summary = results.map((r, i) => ({
    task: ['delayed_jobs', 'weather_warnings', 'maintenance_due'][i],
    status: r.status,
    value: r.status === 'fulfilled' ? r.value : String((r as PromiseRejectedResult).reason),
  }))

  return new Response(JSON.stringify({ summary }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── 1. Delayed automation jobs ─────────────────────────────────────────────────
async function processDelayedJobs(): Promise<string> {
  const { data: jobs, error } = await supabase
    .from('automation_scheduled_jobs')
    .select('*')
    .eq('status', 'queued')
    .lte('run_at', new Date().toISOString())
    .lt('attempts', 3)
    .limit(50)

  if (error) throw error
  if (!jobs?.length) return '0 jobs'

  let processed = 0

  for (const job of jobs) {
    // Mark as processing
    await supabase
      .from('automation_scheduled_jobs')
      .update({ status: 'processing', attempts: job.attempts + 1 })
      .eq('id', job.id)

    try {
      // If chained to a specific action, execute just that action
      if (job.chained_action_id) {
        const { data: action } = await supabase
          .from('automation_actions')
          .select('*')
          .eq('id', job.chained_action_id)
          .single()

        if (action) {
          await callFunction('run-automation', {
            event_type: action.action_type,
            lead_id: job.lead_id,
            client_id: job.payload?.client_id,
            payload: job.payload,
          })
        }
      } else {
        // Re-fire the parent automation
        await callFunction('run-automation', {
          event_type: 'scheduled_trigger',
          lead_id: job.lead_id,
          client_id: job.payload?.client_id,
          payload: job.payload,
        })
      }

      await supabase
        .from('automation_scheduled_jobs')
        .update({ status: 'complete' })
        .eq('id', job.id)

      processed++
    } catch (err) {
      console.error(`Job ${job.id} failed:`, err)
      const newStatus = job.attempts + 1 >= 3 ? 'failed' : 'queued'
      await supabase
        .from('automation_scheduled_jobs')
        .update({ status: newStatus })
        .eq('id', job.id)
    }
  }

  return `${processed}/${jobs.length} jobs`
}

// ── 2. Weather warnings — 48h lookahead ───────────────────────────────────────
async function processWeatherWarnings(): Promise<string> {
  const in48h = new Date(Date.now() + 48 * 3600000).toISOString().split('T')[0]
  const now = new Date().toISOString().split('T')[0]

  // Find leads scheduled in next 48h with coordinates
  const { data: leads, error } = await supabase
    .from('leads')
    .select('id, client_id, full_name, property_lat, property_lng, preferred_date')
    .gte('preferred_date', now)
    .lte('preferred_date', in48h)
    .not('property_lat', 'is', null)
    .not('property_lng', 'is', null)

  if (error) throw error
  if (!leads?.length) return '0 leads checked'

  let warned = 0

  for (const lead of leads) {
    try {
      // Check weather for the job date
      const weatherRes = await callFunction('fetch-weather', {
        lat: lead.property_lat,
        lng: lead.property_lng,
        target_date: lead.preferred_date,
        type: 'forecast',
      })

      const { precipitation_pct, is_snow, is_severe, weather_code } = weatherRes

      // Check tenant weather alerts config
      const { data: config } = await supabase
        .from('contractor_type_config')
        .select('weather_alerts_enabled, weather_email_customer')
        .eq('client_id', lead.client_id)
        .single()

      if (!config?.weather_alerts_enabled) continue

      let taskTitle: string | null = null
      let severity: 'yellow' | 'orange' | 'red' | null = null

      if (weather_code >= 95 || is_severe) {
        taskTitle = `⛈️ Severe weather forecast for ${lead.full_name} on ${lead.preferred_date} — review and contact customer`
        severity = 'red'
      } else if (is_snow) {
        taskTitle = `❄️ Snow forecast for ${lead.full_name} on ${lead.preferred_date} — check rescheduling`
        severity = 'red'
      } else if (precipitation_pct >= 80) {
        taskTitle = `🌧️ Heavy rain (${precipitation_pct}%) forecast for ${lead.full_name} on ${lead.preferred_date}`
        severity = 'orange'
      } else if (precipitation_pct >= 50) {
        taskTitle = `🌦️ Rain (${precipitation_pct}%) forecast for ${lead.full_name} on ${lead.preferred_date} — confirm with customer`
        severity = 'yellow'
      }

      if (taskTitle) {
        // Create task for agent
        await supabase.from('tasks').insert({
          lead_id: lead.id,
          client_id: lead.client_id,
          title: taskTitle,
          assignee_role: 'tenant_admin',
          status: 'open',
        })

        // Optionally email customer for severe conditions
        if (severity === 'red' && config.weather_email_customer) {
          await callFunction('send-client-email', {
            lead_id: lead.id,
            client_id: lead.client_id,
            template_key: 'weather_warning',
            to_field: 'email',
          })
        }

        warned++
      }
    } catch (err) {
      console.error(`Weather check for lead ${lead.id} failed:`, err)
    }
  }

  return `${warned} warnings created`
}

// ── 3. Maintenance due triggers ────────────────────────────────────────────────
async function processMaintenanceDue(): Promise<string> {
  const today = new Date().toISOString().split('T')[0]

  const { data: contracts, error } = await supabase
    .from('maintenance_contracts')
    .select('*')
    .lte('next_service_date', today)
    .eq('auto_schedule', true)
    .eq('is_active', true)

  if (error) throw error
  if (!contracts?.length) return '0 contracts'

  let triggered = 0

  for (const contract of contracts) {
    try {
      await callFunction('run-automation', {
        event_type: 'maintenance_due',
        lead_id: contract.customer_id,
        client_id: contract.client_id,
        payload: { contract_id: contract.id, service_type: contract.service_type },
      })

      // Advance next_service_date based on frequency
      const next = getNextServiceDate(contract.next_service_date, contract.frequency)
      await supabase
        .from('maintenance_contracts')
        .update({ next_service_date: next })
        .eq('id', contract.id)

      triggered++
    } catch (err) {
      console.error(`Maintenance contract ${contract.id} failed:`, err)
    }
  }

  return `${triggered} triggered`
}

// ── Helpers ───────────────────────────────────────────────────────────────────
function getNextServiceDate(current: string, frequency: string): string {
  const date = new Date(current)
  switch (frequency) {
    case 'monthly': date.setMonth(date.getMonth() + 1); break
    case 'quarterly': date.setMonth(date.getMonth() + 3); break
    case 'bi_annual': date.setMonth(date.getMonth() + 6); break
    case 'annual': date.setFullYear(date.getFullYear() + 1); break
  }
  return date.toISOString().split('T')[0]
}

async function callFunction(name: string, payload: unknown) {
  const url = `${Deno.env.get('SUPABASE_URL')}/functions/v1/${name}`
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
    },
    body: JSON.stringify(payload),
  })
  if (!res.ok) throw new Error(`${name} returned ${res.status}: ${await res.text()}`)
  return res.json()
}
