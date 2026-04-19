import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

interface RunAutomationPayload {
  event_type: string
  lead_id: string
  client_id: string
  payload?: Record<string, unknown>
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const body: RunAutomationPayload = await req.json()
  const { event_type, lead_id, client_id, payload = {} } = body

  if (!event_type || !client_id) {
    return new Response(JSON.stringify({ error: 'Missing event_type or client_id' }), { status: 400 })
  }

  // Step 1 — Find active automations matching this trigger
  const { data: automations, error: autoError } = await supabase
    .from('workflow_automations')
    .select('id, name, trigger_event')
    .eq('trigger_event', event_type)
    .eq('client_id', client_id)
    .eq('is_active', true)

  if (autoError) {
    console.error('Error fetching automations:', autoError)
    return new Response(JSON.stringify({ error: autoError.message }), { status: 500 })
  }

  const results: string[] = []

  for (const automation of automations ?? []) {
    // Step 2 — Check conditions (all must pass — AND logic)
    const { data: conditions } = await supabase
      .from('automation_conditions')
      .select('*')
      .eq('automation_id', automation.id)

    let conditionsPassed = true

    if (conditions && conditions.length > 0 && lead_id) {
      const { data: lead } = await supabase
        .from('leads')
        .select('*')
        .eq('id', lead_id)
        .single()

      for (const condition of conditions) {
        const fieldValue = lead?.[condition.field as keyof typeof lead]
        if (!evaluateCondition(fieldValue, condition.operator, condition.value)) {
          conditionsPassed = false
          break
        }
      }
    }

    if (!conditionsPassed) {
      await logRun(automation.id, lead_id, event_type, 'skipped', [], payload)
      continue
    }

    // Step 3 — Execute actions in order
    const { data: actions } = await supabase
      .from('automation_actions')
      .select('*')
      .eq('automation_id', automation.id)
      .order('execution_order', { ascending: true })

    const actionsFired: string[] = []
    let runStatus = 'success'
    let runError: string | undefined

    for (const action of actions ?? []) {
      try {
        await executeAction(action, lead_id, client_id, payload)
        actionsFired.push(action.action_type)
      } catch (err) {
        console.error(`Action ${action.action_type} failed:`, err)
        runStatus = 'failed'
        runError = String(err)
        break
      }
    }

    // Step 4 — Audit log (always)
    await logRun(automation.id, lead_id, event_type, runStatus, actionsFired, payload, runError)
    results.push(`${automation.name}: ${runStatus}`)
  }

  return new Response(JSON.stringify({ fired: results.length, results }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── Condition evaluator ───────────────────────────────────────────────────────
function evaluateCondition(fieldValue: unknown, operator: string, conditionValue: string | null): boolean {
  const val = String(fieldValue ?? '')
  const cond = conditionValue ?? ''

  switch (operator) {
    case 'equals': return val === cond
    case 'not_equals': return val !== cond
    case 'contains': return val.toLowerCase().includes(cond.toLowerCase())
    case 'gt': return Number(val) > Number(cond)
    case 'lt': return Number(val) < Number(cond)
    case 'in': return cond.split(',').map(s => s.trim()).includes(val)
    case 'is_null': return fieldValue == null || val === ''
    case 'is_not_null': return fieldValue != null && val !== ''
    default: return true
  }
}

// ── Action executor ───────────────────────────────────────────────────────────
async function executeAction(
  action: { action_type: string; action_config: Record<string, unknown> },
  lead_id: string,
  client_id: string,
  triggerPayload: Record<string, unknown>
) {
  const config = action.action_config ?? {}

  switch (action.action_type) {
    case 'send_email':
      await callFunction('send-client-email', {
        lead_id,
        client_id,
        template_key: config.template_key,
        to_field: config.to_field ?? 'email',
      })
      break

    case 'push_notification':
      await callFunction('send-push-notification', {
        lead_id,
        client_id,
        title: config.title,
        body: config.body,
        target: config.target ?? 'agent',
        url: config.url_template,
      })
      break

    case 'create_task':
      await supabase.from('tasks').insert({
        lead_id,
        client_id,
        title: config.title,
        assignee_role: config.assignee_role,
        due_at: config.due_offset_hours
          ? new Date(Date.now() + Number(config.due_offset_hours) * 3600000).toISOString()
          : null,
        status: 'open',
      })
      break

    case 'update_field': {
      const table = (config.table as string) ?? 'leads'
      const field = config.field as string
      const value = config.value
      await supabase.from(table).update({ [field]: value }).eq('id', lead_id)
      break
    }

    case 'advance_stage': {
      const targetStage = config.target_stage as string
      await supabase
        .from('leads')
        .update({ pipeline_stage: targetStage, updated_at: new Date().toISOString() })
        .eq('id', lead_id)
      // Re-trigger automation engine for the new stage
      await callFunction('run-automation', {
        event_type: 'stage_change',
        lead_id,
        client_id,
        payload: { new_stage: targetStage },
      })
      break
    }

    case 'delay': {
      const offsetHours = Number(config.offset_hours ?? 24)
      const runAt = new Date(Date.now() + offsetHours * 3600000).toISOString()
      const chainedActionId = config.chained_action_id as string | undefined

      await supabase.from('automation_scheduled_jobs').insert({
        automation_id: config.automation_id,
        chained_action_id: chainedActionId ?? null,
        lead_id,
        run_at: runAt,
        status: 'queued',
        payload: { ...triggerPayload, client_id },
        attempts: 0,
      })
      break
    }

    case 'create_invoice':
      await callFunction('create-stripe-invoice', {
        lead_id,
        client_id,
        type: config.invoice_type ?? 'deposit',
        amount: config.amount,
      })
      break

    case 'webhook': {
      const url = config.url as string
      if (url) {
        await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ lead_id, client_id, ...triggerPayload }),
        })
      }
      break
    }

    default:
      console.warn(`Unknown action type: ${action.action_type}`)
  }
}

// ── Helpers ───────────────────────────────────────────────────────────────────
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
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`${name} returned ${res.status}: ${text}`)
  }
  return res.json()
}

async function logRun(
  automationId: string,
  leadId: string | undefined,
  triggerEvent: string,
  status: string,
  actionsFired: string[],
  payload: unknown,
  error?: string
) {
  await supabase.from('automation_runs').insert({
    automation_id: automationId,
    lead_id: leadId ?? null,
    trigger_event: triggerEvent,
    status,
    actions_fired: actionsFired,
    payload,
    error: error ?? null,
  })
}
