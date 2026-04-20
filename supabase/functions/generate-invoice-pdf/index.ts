import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function buildHtml(invoice: any, lead: any, brand: any): string {
  const gold = brand?.primary_color ?? '#F5C542'
  const isPaid = invoice.status === 'paid'

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 48px; color: #111; font-size: 13px; }
  .header { display: flex; justify-content: space-between; align-items: flex-start;
    border-bottom: 3px solid ${gold}; padding-bottom: 16px; margin-bottom: 32px; }
  .company { font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
  .invoice-badge { font-size: 28px; font-weight: 900; text-align: right; color: #333; }
  .status-badge { display: inline-block; padding: 4px 16px; border-radius: 999px; font-weight: 700;
    font-size: 12px; text-transform: uppercase; margin-top: 6px;
    background: ${isPaid ? '#d1fae5' : '#fef3c7'}; color: ${isPaid ? '#065f46' : '#92400e'}; }
  .bill-to { margin-bottom: 32px; }
  .label { font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #999; margin-bottom: 4px; }
  .amount-box { background: #f9f9f9; border: 1px solid #eee; border-radius: 8px; padding: 24px; text-align: center; margin: 32px 0; }
  .amount-label { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #999; }
  .amount-value { font-size: 48px; font-weight: 900; margin: 8px 0; }
  .pay-link { display: inline-block; margin-top: 16px; padding: 12px 32px; background: ${gold}; color: #000;
    font-weight: 700; text-decoration: none; border-radius: 8px; font-size: 14px; }
  .footer { margin-top: 48px; font-size: 11px; color: #999; text-align: center; border-top: 1px solid #eee; padding-top: 16px; }
</style>
</head>
<body>
<div class="header">
  <div>
    <div class="company">${brand?.company_name ?? 'Contractor'}</div>
    <div style="color:#666;font-size:12px;margin-top:4px">${brand?.email ?? ''}</div>
  </div>
  <div class="invoice-badge">
    INVOICE
    <br>
    <span class="status-badge">${invoice.status}</span>
  </div>
</div>

<div class="bill-to">
  <div class="label">Bill To</div>
  <div style="font-weight:600">${lead?.full_name ?? 'Client'}</div>
  ${lead?.email ? `<div style="color:#666">${lead.email}</div>` : ''}
  ${lead?.property_address ? `<div style="color:#666">${lead.property_address}</div>` : ''}
</div>

<div style="display:flex;gap:32px;margin-bottom:32px">
  <div><div class="label">Invoice Date</div><div>${new Date(invoice.created_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div></div>
  <div><div class="label">Type</div><div style="text-transform:capitalize">${invoice.type}</div></div>
  ${invoice.paid_at ? `<div><div class="label">Paid On</div><div>${new Date(invoice.paid_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</div></div>` : ''}
</div>

<div class="amount-box">
  <div class="amount-label">Amount ${isPaid ? 'Paid' : 'Due'}</div>
  <div class="amount-value">$${Number(invoice.amount).toFixed(2)}</div>
  ${!isPaid && invoice.stripe_payment_url ? `<a href="${invoice.stripe_payment_url}" class="pay-link">Pay Now →</a>` : ''}
  ${isPaid ? '<div style="color:#065f46;font-weight:700;margin-top:8px">✓ Payment Received — Thank You</div>' : ''}
</div>

<div class="footer">
  ${brand?.company_name ?? 'Contractor'} &nbsp;·&nbsp; Invoice generated ${new Date().toLocaleDateString()}
</div>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { invoice_id } = await req.json()
  if (!invoice_id) {
    return new Response(JSON.stringify({ error: 'Missing invoice_id' }), { status: 400 })
  }

  const { data: invoice } = await supabase
    .from('invoices')
    .select('*')
    .eq('id', invoice_id)
    .single()

  if (!invoice) {
    return new Response(JSON.stringify({ error: 'Invoice not found' }), { status: 404 })
  }

  const [{ data: lead }, { data: brand }] = await Promise.all([
    supabase.from('leads').select('full_name, email, property_address').eq('id', invoice.lead_id).single(),
    supabase.from('brand_settings').select('primary_color, clients(company_name, email)').eq('client_id', invoice.client_id).single(),
  ])

  const html = buildHtml(invoice, lead, {
    primary_color: (brand as any)?.primary_color,
    company_name: (brand as any)?.clients?.company_name,
    email: (brand as any)?.clients?.email,
  })

  const pdfApiKey = Deno.env.get('PDFSHIFT_API_KEY')
  if (!pdfApiKey) {
    return new Response(html, { headers: { 'Content-Type': 'text/html' } })
  }

  const pdfRes = await fetch('https://api.pdfshift.io/v3/convert/pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`api:${pdfApiKey}`)}`,
    },
    body: JSON.stringify({ source: html, format: 'Letter' }),
  })

  if (!pdfRes.ok) {
    return new Response(JSON.stringify({ error: 'PDF generation failed' }), { status: 502 })
  }

  const pdfBytes = await pdfRes.arrayBuffer()
  const path = `invoices/${invoice_id}/invoice.pdf`

  await supabase.storage.from('job-files').upload(path, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  })

  const { data: { publicUrl } } = supabase.storage.from('job-files').getPublicUrl(path)

  return new Response(JSON.stringify({ pdf_url: publicUrl }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
