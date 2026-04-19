import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

// Public endpoint — token-based, no auth required
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { token } = await req.json()
  if (!token) {
    return new Response(JSON.stringify({ error: 'Missing token' }), { status: 400 })
  }

  // Fetch lead by portal token
  const { data: lead, error } = await supabase
    .from('leads')
    .select('id, client_id, full_name, pipeline_stage, project_type, preferred_date, property_address, created_at')
    .eq('portal_token', token)
    .single()

  if (error || !lead) {
    return new Response(JSON.stringify({ error: 'Not found' }), { status: 404 })
  }

  // Fetch brand settings
  const { data: brand } = await supabase
    .from('brand_settings')
    .select('brand_name, logo_url, primary_color, secondary_color')
    .eq('client_id', lead.client_id)
    .single()

  // Fetch latest estimate
  const { data: estimate } = await supabase
    .from('estimates')
    .select('id, status, total_contractor_amount, created_at')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })
    .limit(1)
    .single()

  // Fetch invoices
  const { data: invoices } = await supabase
    .from('invoices')
    .select('id, amount, type, status, stripe_payment_url, paid_at, created_at')
    .eq('lead_id', lead.id)
    .order('created_at', { ascending: false })

  // Fetch tasks visible to customer (open only)
  const { data: tasks } = await supabase
    .from('tasks')
    .select('id, title, status, due_at')
    .eq('lead_id', lead.id)
    .eq('status', 'open')
    .limit(10)

  return new Response(JSON.stringify({
    lead,
    brand: brand ?? { brand_name: 'Your Contractor', logo_url: null, primary_color: '#F5C542', secondary_color: '#0A1628' },
    estimate: estimate ?? null,
    invoices: invoices ?? [],
    tasks: tasks ?? [],
  }), {
    headers: {
      'Content-Type': 'application/json',
      'Access-Control-Allow-Origin': '*',
    },
  })
})
