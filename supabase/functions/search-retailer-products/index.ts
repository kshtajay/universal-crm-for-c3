import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const LOCAL_RESULTS_THRESHOLD = 5

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { query, client_id, limit = 20 } = await req.json()

  if (!query || !client_id) {
    return new Response(JSON.stringify({ error: 'Missing query or client_id' }), { status: 400 })
  }

  // Search local catalog: client-specific rows + platform defaults (no client_id)
  const { data: localResults } = await supabase
    .from('materials_catalog')
    .select('id, name, unit, unit_price, category')
    .or(`client_id.eq.${client_id},client_id.is.null`)
    .or(`name.ilike.%${query}%,description.ilike.%${query}%`)
    .limit(limit)

  const results: Array<{
    id: string
    name: string
    unit: string
    price: number | null
    source: 'local' | 'lowes'
  }> = (localResults ?? []).map(r => ({
    id: r.id,
    name: r.name,
    unit: r.unit ?? 'each',
    price: r.unit_price ?? null,
    source: 'local' as const,
  }))

  // Fall back to Lowe's if local results are sparse
  if (results.length < LOCAL_RESULTS_THRESHOLD) {
    const apiKey = Deno.env.get('LOWES_API_KEY')
    if (apiKey) {
      try {
        const res = await fetch(
          `https://api.lowes.com/v1/products/search?q=${encodeURIComponent(query)}&limit=${limit - results.length}`,
          {
            headers: {
              Authorization: `Bearer ${apiKey}`,
              Accept: 'application/json',
            },
          }
        )

        if (res.ok) {
          const data = await res.json()
          const lowesItems = (data.products ?? data.items ?? []) as Array<{
            id?: string
            itemNumber?: string
            name?: string
            title?: string
            price?: number
            currentPrice?: number
            unitOfMeasure?: string
          }>

          for (const item of lowesItems) {
            results.push({
              id: item.id ?? item.itemNumber ?? '',
              name: item.name ?? item.title ?? '',
              unit: item.unitOfMeasure ?? 'each',
              price: item.price ?? item.currentPrice ?? null,
              source: 'lowes',
            })
          }
        }
      } catch (err) {
        console.error('Lowe\'s search failed:', err)
      }
    }
  }

  return new Response(JSON.stringify({ results: results.slice(0, limit) }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
