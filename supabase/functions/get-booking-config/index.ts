import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Public endpoint — no auth required. Returns branding + form fields for a client slug.
Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { slug, type = 'booking' } = await req.json()

  if (!slug) {
    return new Response(JSON.stringify({ error: 'Missing slug' }), { status: 400 })
  }

  // Fetch client by slug
  const { data: client, error: clientError } = await supabase
    .from('clients')
    .select('id, company_name, contractor_type_id')
    .eq('slug', slug)
    .eq('is_active', true)
    .single()

  if (clientError || !client) {
    return new Response(JSON.stringify({ error: 'Client not found' }), { status: 404 })
  }

  // Fetch brand settings
  const { data: brand } = await supabase
    .from('brand_settings')
    .select('brand_name, logo_url, primary_color, secondary_color, tagline')
    .eq('client_id', client.id)
    .single()

  // Fetch contractor type name for filtering trade-specific fields
  const { data: ctType } = await supabase
    .from('contractor_types')
    .select('type_key')
    .eq('id', client.contractor_type_id)
    .single()

  const contractorTypeKey = ctType?.type_key ?? null

  // Fetch client-specific booking fields first, fall back to platform intake defaults
  let fields: unknown[] = []

  if (type === 'booking') {
    const { data: bpFields } = await supabase
      .from('booking_page_fields')
      .select('field_key, field_label, field_type, display_order, required, options_json, placeholder')
      .eq('client_id', client.id)
      .order('display_order', { ascending: true })

    if (bpFields && bpFields.length > 0) {
      fields = bpFields
    } else {
      // Fall back to platform intake defaults (client_id IS NULL)
      // Show who_where + what_when + notes sections; filter trade_details by type
      const { data: intakeFields } = await supabase
        .from('intake_fields')
        .select('field_key, field_label, field_type, section, display_order, required, options_json, placeholder, visible_for_types, maps_to_leads_column')
        .is('client_id', null)
        .eq('is_active', true)
        .order('section', { ascending: true })
        .order('display_order', { ascending: true })

      fields = (intakeFields ?? []).filter((f: any) => {
        if (f.section !== 'trade_details') return true
        if (!f.visible_for_types || f.visible_for_types.length === 0) return true
        return contractorTypeKey && f.visible_for_types.includes(contractorTypeKey)
      })
    }
  } else {
    // Assessment: use assessment_fields or all intake defaults
    const { data: assessFields } = await supabase
      .from('assessment_fields')
      .select('field_key, field_label, field_type, display_order, required, options_json, placeholder')
      .eq('client_id', client.id)
      .order('display_order', { ascending: true })

    if (assessFields && assessFields.length > 0) {
      fields = assessFields
    } else {
      const { data: intakeFields } = await supabase
        .from('intake_fields')
        .select('field_key, field_label, field_type, section, display_order, required, options_json, placeholder, visible_for_types, maps_to_leads_column')
        .is('client_id', null)
        .eq('is_active', true)
        .order('section', { ascending: true })
        .order('display_order', { ascending: true })

      fields = (intakeFields ?? []).filter((f: any) => {
        if (f.section !== 'trade_details') return true
        if (!f.visible_for_types || f.visible_for_types.length === 0) return true
        return contractorTypeKey && f.visible_for_types.includes(contractorTypeKey)
      })
    }
  }

  // Fetch deposit rules
  const { data: depositRules } = await supabase
    .from('deposit_rules')
    .select('consultation_fee, assessment_fee, deposit_pct, show_consultation_banner')
    .eq('client_id', client.id)
    .single()

  return new Response(JSON.stringify({
    client: {
      id: client.id,
      company_name: client.company_name,
      contractor_type: contractorTypeKey,
    },
    brand: brand ?? {
      brand_name: client.company_name,
      logo_url: null,
      primary_color: '#F5C542',
      secondary_color: '#0A1628',
      tagline: null,
    },
    fields,
    deposit_rules: depositRules ?? null,
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
