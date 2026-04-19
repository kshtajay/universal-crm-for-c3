import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { lead_id, client_id, template_key, to_field = 'email' } = await req.json()

  if (!client_id || !template_key) {
    return new Response(JSON.stringify({ error: 'Missing client_id or template_key' }), { status: 400 })
  }

  // Fetch lead data for variable substitution
  let lead: Record<string, unknown> = {}
  if (lead_id) {
    const { data } = await supabase.from('leads').select('*').eq('id', lead_id).single()
    if (data) lead = data
  }

  // Fetch client/brand data for variable substitution
  const { data: client } = await supabase
    .from('clients')
    .select('company_name, brand_settings(brand_name, primary_color)')
    .eq('id', client_id)
    .single()

  // Template lookup: client override first, then platform default
  let template: { subject: string; body_html: string; from_name?: string; from_email?: string } | null = null

  const { data: clientTpl } = await supabase
    .from('client_email_templates')
    .select('subject, body_html, from_name, from_email')
    .eq('client_id', client_id)
    .eq('template_key', template_key)
    .single()

  if (clientTpl) {
    template = clientTpl
  } else {
    const { data: platformTpl } = await supabase
      .from('email_templates')
      .select('subject, body_html, from_name, from_email')
      .eq('template_key', template_key)
      .single()
    template = platformTpl
  }

  if (!template) {
    await logEmailEvent(lead_id, client_id, template_key, '', 'failed', 'Template not found')
    return new Response(JSON.stringify({ error: `Template '${template_key}' not found` }), { status: 404 })
  }

  // Resolve recipient email
  const toEmail = String(lead[to_field] ?? '')
  if (!toEmail) {
    await logEmailEvent(lead_id, client_id, template_key, '', 'failed', `No email at field '${to_field}'`)
    return new Response(JSON.stringify({ error: `No email found at lead.${to_field}` }), { status: 400 })
  }

  // Variable replacement context
  const vars: Record<string, string> = {
    'lead.full_name': String(lead.full_name ?? ''),
    'lead.email': String(lead.email ?? ''),
    'lead.phone': String(lead.phone ?? ''),
    'lead.preferred_date': String(lead.preferred_date ?? ''),
    'lead.service_type': String(lead.service_type ?? ''),
    'lead.property_address': String(lead.property_address ?? ''),
    'client.business_name': String((client as any)?.company_name ?? ''),
    'client.brand_name': String((client as any)?.brand_settings?.brand_name ?? (client as any)?.company_name ?? ''),
  }

  const render = (str: string) =>
    str.replace(/\{\{([^}]+)\}\}/g, (_, key) => vars[key.trim()] ?? '')

  const subject = render(template.subject)
  const html = render(template.body_html)

  try {
    await callFunction('apps-script-proxy', {
      to: toEmail,
      subject,
      html,
      from_name: template.from_name ?? vars['client.brand_name'],
      from_email: template.from_email ?? '',
    })

    await logEmailEvent(lead_id, client_id, template_key, toEmail, 'sent')
    return new Response(JSON.stringify({ success: true }), {
      headers: { 'Content-Type': 'application/json' },
    })
  } catch (err) {
    await logEmailEvent(lead_id, client_id, template_key, toEmail, 'failed', String(err))
    return new Response(JSON.stringify({ error: String(err) }), { status: 500 })
  }
})

async function logEmailEvent(
  leadId: string | undefined,
  clientId: string,
  templateKey: string,
  toEmail: string,
  status: 'sent' | 'failed',
  error?: string
) {
  await supabase.from('email_events').insert({
    lead_id: leadId ?? null,
    client_id: clientId,
    template_key: templateKey,
    to_address: toEmail,
    status,
    error: error ?? null,
  })
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
