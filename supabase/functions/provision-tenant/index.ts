import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const {
    company_name,
    slug,
    contractor_type,
    email,
    package_name = 'Professional',
    owner_user_id,
  } = await req.json()

  if (!company_name || !slug || !owner_user_id) {
    return new Response(
      JSON.stringify({ error: 'Missing required fields: company_name, slug, owner_user_id' }),
      { status: 400 }
    )
  }

  // 1. Resolve package
  const { data: pkg } = await supabase
    .from('packages')
    .select('id')
    .eq('name', package_name)
    .single()

  // 2. Create client row
  const { data: client, error: clientErr } = await supabase
    .from('clients')
    .insert({
      company_name,
      slug,
      contractor_type: contractor_type ?? null,
      package_id: pkg?.id ?? null,
      is_active: true,
    })
    .select('id')
    .single()

  if (clientErr || !client) {
    return new Response(
      JSON.stringify({ error: 'Failed to create client', detail: clientErr?.message }),
      { status: 500 }
    )
  }

  const clientId = client.id

  // 3. Assign owner user to client
  await supabase.from('client_user_assignments').insert({
    client_id: clientId,
    user_id: owner_user_id,
    role: 'owner',
  })

  // 4. Create default brand_settings row
  await supabase.from('brand_settings').insert({
    client_id: clientId,
    primary_color: '#F5C542',
    secondary_color: '#0A1628',
  })

  // 5. Assign default workflow based on contractor_type
  if (contractor_type) {
    const { data: template } = await supabase
      .from('workflow_templates')
      .select('id')
      .eq('contractor_type', contractor_type)
      .limit(1)
      .single()

    if (template) {
      await supabase.from('client_workflows').insert({
        client_id: clientId,
        workflow_template_id: template.id,
      })
    }
  }

  // 6. Create default deposit rule (25% deposit)
  await supabase.from('deposit_rules').insert({
    client_id: clientId,
    deposit_type: 'percentage',
    deposit_pct: 25,
    deposit_amount: null,
    is_active: true,
  })

  // 7. Send welcome email to owner
  if (email) {
    await supabase.functions.invoke('send-client-email', {
      body: {
        client_id: clientId,
        template_key: 'welcome',
        to_field: email,
        lead_id: null,
      },
    }).catch(() => null) // non-fatal
  }

  return new Response(
    JSON.stringify({
      client_id: clientId,
      slug,
      dashboard_url: `/${slug}/dashboard`,
    }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
