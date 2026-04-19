import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Public endpoint — no auth required. Creates a lead from a booking form submission.
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { slug, fields: formFields, source = 'booking_page' } = await req.json()

  if (!slug || !formFields) {
    return new Response(JSON.stringify({ error: 'Missing slug or fields' }), { status: 400 })
  }

  // Resolve client
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, contractor_type_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (clientError || !client) {
    return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 })
  }

  const { data: ctType } = await supabase
    .from('contractor_types')
    .select('type_key')
    .eq('id', client.contractor_type_id)
    .single()

  // Map form fields to lead columns (direct mappings)
  const LEAD_COLUMNS = new Set([
    'full_name', 'phone', 'email', 'property_address', 'property_lat', 'property_lng',
    'project_type', 'budget_range', 'preferred_date', 'preferred_time',
    'urgency', 'urgency_level',
  ])

  const leadData: Record<string, unknown> = {
    client_id: client.id,
    pipeline_stage: 'new_lead',
    contractor_type: ctType?.type_key ?? null,
    lead_source: source,
  }

  const extraFields: Array<{ field_key: string; field_value: string }> = []

  for (const [key, value] of Object.entries(formFields)) {
    if (value === null || value === undefined || value === '') continue
    if (LEAD_COLUMNS.has(key)) {
      leadData[key] = value
    } else {
      extraFields.push({ field_key: key, field_value: String(value) })
    }
  }

  // Create lead
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .insert(leadData)
    .select('id, portal_token')
    .single()

  if (leadError || !lead) {
    return new Response(JSON.stringify({ error: leadError?.message ?? 'Failed to create lead' }), { status: 500 })
  }

  // Store extra fields in lead_intake_data
  if (extraFields.length > 0) {
    await supabase.from('lead_intake_data').insert(
      extraFields.map(f => ({ lead_id: lead.id, client_id: client.id, ...f }))
    )
  }

  // Fire automation
  try {
    await callFunction('run-automation', {
      event_type: 'booking_submitted',
      lead_id: lead.id,
      client_id: client.id,
      payload: { source },
    })
  } catch (err) {
    console.error('run-automation failed:', err)
  }

  return new Response(JSON.stringify({
    success: true,
    lead_id: lead.id,
    portal_token: lead.portal_token,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
})

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
