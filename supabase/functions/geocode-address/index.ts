import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { address, lead_id } = await req.json()

  if (!address) {
    return new Response(JSON.stringify({ error: 'Missing address' }), { status: 400 })
  }

  const radarKey = Deno.env.get('RADAR_SECRET_KEY')
  if (!radarKey) {
    return new Response(JSON.stringify({ error: 'RADAR_SECRET_KEY not configured' }), { status: 500 })
  }

  const url = `https://api.radar.io/v1/geocode/forward?query=${encodeURIComponent(address)}&country=US`
  const res = await fetch(url, {
    headers: { Authorization: radarKey },
  })

  if (!res.ok) {
    return new Response(JSON.stringify({ error: 'Geocoding failed', status: res.status }), { status: 502 })
  }

  const json = await res.json()
  const first = json.addresses?.[0]

  if (!first) {
    return new Response(JSON.stringify({ error: 'No results found' }), { status: 404 })
  }

  const result = {
    lat: first.latitude,
    lng: first.longitude,
    formatted_address: first.formattedAddress ?? address,
    city: first.city ?? null,
    state: first.state ?? null,
    zip: first.postalCode ?? null,
  }

  // Persist lat/lng back to lead if provided
  if (lead_id) {
    await supabase
      .from('leads')
      .update({ property_lat: result.lat, property_lng: result.lng })
      .eq('id', lead_id)
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
})
