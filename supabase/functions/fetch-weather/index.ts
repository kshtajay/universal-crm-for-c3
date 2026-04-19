import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CACHE_TTL_MS = 6 * 3600 * 1000 // 6 hours

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { lat, lng, target_date, type = 'forecast' } = await req.json()

  if (!lat || !lng || !target_date) {
    return new Response(JSON.stringify({ error: 'Missing lat, lng, or target_date' }), { status: 400 })
  }

  const cacheKey = `${lat}:${lng}:${target_date}`

  // Check cache
  const { data: cached } = await supabase
    .from('weather_cache')
    .select('*')
    .eq('cache_key', cacheKey)
    .single()

  if (cached && new Date(cached.fetched_at).getTime() > Date.now() - CACHE_TTL_MS) {
    return new Response(JSON.stringify(cached.forecast_json), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  // Fetch from Open-Meteo
  const url = new URL('https://api.open-meteo.com/v1/forecast')
  url.searchParams.set('latitude', String(lat))
  url.searchParams.set('longitude', String(lng))
  url.searchParams.set('daily', 'precipitation_probability_max,weathercode,snowfall_sum')
  url.searchParams.set('timezone', 'auto')
  url.searchParams.set('start_date', target_date)
  url.searchParams.set('end_date', target_date)

  const res = await fetch(url.toString())
  if (!res.ok) throw new Error(`Open-Meteo returned ${res.status}: ${await res.text()}`)

  const data = await res.json()
  const daily = data.daily

  const precipitation_pct: number = daily.precipitation_probability_max?.[0] ?? 0
  const weather_code: number = daily.weathercode?.[0] ?? 0
  const snowfall: number = daily.snowfall_sum?.[0] ?? 0

  const is_snow = snowfall > 0 || (weather_code >= 71 && weather_code <= 77)
  const is_severe = weather_code >= 95

  const description = describeWeather(weather_code, precipitation_pct)

  const forecast = { precipitation_pct, is_snow, is_severe, weather_code, description }

  // Upsert cache
  await supabase.from('weather_cache').upsert({
    cache_key: cacheKey,
    lat,
    lng,
    target_date,
    forecast_json: forecast,
    fetched_at: new Date().toISOString(),
  }, { onConflict: 'cache_key' })

  return new Response(JSON.stringify(forecast), {
    headers: { 'Content-Type': 'application/json' },
  })
})

function describeWeather(code: number, precipPct: number): string {
  if (code >= 95) return 'Thunderstorm / severe weather'
  if (code >= 80) return 'Rain showers'
  if (code >= 71) return 'Snow'
  if (code >= 61) return 'Rain'
  if (code >= 51) return 'Drizzle'
  if (code >= 45) return 'Fog'
  if (precipPct >= 50) return 'Likely rain'
  if (code <= 1) return 'Clear'
  return 'Partly cloudy'
}
