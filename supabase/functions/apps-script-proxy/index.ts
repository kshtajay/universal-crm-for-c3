Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const gasUrl = Deno.env.get('GAS_WEBHOOK_URL')
  if (!gasUrl) {
    return new Response(JSON.stringify({ error: 'GAS_WEBHOOK_URL not configured' }), { status: 500 })
  }

  const body = await req.json()
  const { to, subject, html, from_name, from_email } = body

  if (!to || !subject || !html) {
    return new Response(JSON.stringify({ error: 'Missing required fields: to, subject, html' }), { status: 400 })
  }

  const res = await fetch(gasUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ to, subject, html, from_name, from_email }),
  })

  if (!res.ok) {
    const text = await res.text()
    throw new Error(`GAS returned ${res.status}: ${text}`)
  }

  return new Response(JSON.stringify({ success: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
