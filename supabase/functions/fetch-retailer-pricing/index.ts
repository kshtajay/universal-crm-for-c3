import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const CACHE_TTL_MS = 24 * 3600 * 1000 // 24 hours

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { product_id, retailer = 'lowes' } = await req.json()

  if (!product_id) {
    return new Response(JSON.stringify({ error: 'Missing product_id' }), { status: 400 })
  }

  // Check cache
  const { data: cached } = await supabase
    .from('retailer_price_cache')
    .select('*')
    .eq('product_id', product_id)
    .eq('retailer', retailer)
    .single()

  if (cached && new Date(cached.fetched_at).getTime() > Date.now() - CACHE_TTL_MS) {
    return new Response(JSON.stringify({
      product_id: cached.product_id,
      price: cached.price,
      unit: cached.unit,
      retailer: cached.retailer,
      fetched_at: cached.fetched_at,
    }), { headers: { 'Content-Type': 'application/json' } })
  }

  // Fetch from retailer API
  let price: number | null = null
  let unit: string = 'each'
  let productName: string = product_id

  if (retailer === 'lowes') {
    const apiKey = Deno.env.get('LOWES_API_KEY')
    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LOWES_API_KEY not configured' }), { status: 500 })
    }

    const res = await fetch(`https://api.lowes.com/v1/products/${product_id}`, {
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: 'application/json',
      },
    })

    if (res.ok) {
      const data = await res.json()
      price = data.price ?? data.currentPrice ?? null
      unit = data.unitOfMeasure ?? 'each'
      productName = data.name ?? product_id
    }
  }

  if (price === null) {
    return new Response(JSON.stringify({ error: 'Product not found or price unavailable' }), { status: 404 })
  }

  const now = new Date().toISOString()

  // Upsert cache
  await supabase.from('retailer_price_cache').upsert({
    product_id,
    retailer,
    product_name: productName,
    price,
    unit,
    fetched_at: now,
  }, { onConflict: 'product_id,retailer' })

  return new Response(JSON.stringify({ product_id, price, unit, retailer, fetched_at: now }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
