import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function buildHtml(estimate: any, items: any[], lead: any, brand: any): string {
  const gold = brand?.primary_color ?? '#F5C542'
  const contractorItems = items.filter((i: any) => i.supplied_by === 'contractor')
  const customerItems = items.filter((i: any) => i.supplied_by === 'customer')

  const rows = (list: any[], showMarkup: boolean) =>
    list.map((i: any) => `
      <tr>
        <td>${i.description}</td>
        <td style="text-align:center">${i.quantity} ${i.unit}</td>
        ${showMarkup ? `<td style="text-align:right">$${Number(i.unit_cost).toFixed(2)}</td>` : ''}
        <td style="text-align:right">$${(i.quantity * (showMarkup ? i.unit_cost : (i.customer_unit_cost ?? i.unit_cost))).toFixed(2)}</td>
      </tr>`).join('')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Arial, sans-serif; margin: 0; padding: 40px; color: #111; font-size: 13px; }
  .header { border-bottom: 3px solid ${gold}; padding-bottom: 16px; margin-bottom: 24px; }
  .company { font-size: 22px; font-weight: 900; text-transform: uppercase; letter-spacing: 1px; }
  .meta { color: #666; font-size: 12px; margin-top: 4px; }
  .section-title { font-size: 11px; font-weight: 700; text-transform: uppercase; letter-spacing: 1px; color: #666; margin: 20px 0 8px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #f5f5f5; text-align: left; padding: 8px; font-size: 11px; text-transform: uppercase; }
  td { padding: 8px; border-bottom: 1px solid #eee; }
  .totals { margin-top: 16px; text-align: right; }
  .total-row { display: flex; justify-content: flex-end; gap: 24px; padding: 4px 0; }
  .total-label { color: #666; }
  .grand-total { font-size: 18px; font-weight: 900; border-top: 2px solid ${gold}; padding-top: 8px; margin-top: 8px; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase;
    background: ${estimate.status === 'approved' ? '#d1fae5' : estimate.status === 'sent' ? '#dbeafe' : '#f3f4f6'};
    color: ${estimate.status === 'approved' ? '#065f46' : estimate.status === 'sent' ? '#1e40af' : '#374151'}; }
</style>
</head>
<body>
<div class="header">
  <div class="company">${brand?.company_name ?? 'Contractor'}</div>
  <div class="meta">ESTIMATE &nbsp;·&nbsp; <span class="status">${estimate.status}</span></div>
  <div class="meta" style="margin-top:8px">
    <strong>Client:</strong> ${lead?.full_name ?? 'N/A'} &nbsp;|&nbsp;
    <strong>Address:</strong> ${lead?.property_address ?? 'N/A'} &nbsp;|&nbsp;
    <strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
  </div>
</div>

${contractorItems.length > 0 ? `
<div class="section-title">Section A — Contractor Charges</div>
<table>
  <thead><tr><th>Description</th><th style="text-align:center">Qty / Unit</th><th style="text-align:right">Unit Cost</th><th style="text-align:right">Total</th></tr></thead>
  <tbody>${rows(contractorItems, true)}</tbody>
</table>
<div class="totals">
  <div class="total-row"><span class="total-label">Markup (${estimate.markup_pct ?? 0}%):</span><span>included</span></div>
  <div class="total-row"><span class="total-label">Tax (${estimate.tax_pct ?? 0}%):</span><span>included</span></div>
  <div class="total-row grand-total"><span>Total Contractor Charges:</span><span>$${Number(estimate.total_contractor_amount ?? 0).toFixed(2)}</span></div>
</div>
` : ''}

${customerItems.length > 0 ? `
<div class="section-title" style="margin-top:32px">Section B — Customer Shopping List</div>
<table>
  <thead><tr><th>Item</th><th style="text-align:center">Qty / Unit</th><th style="text-align:right">Est. Cost</th></tr></thead>
  <tbody>${rows(customerItems, false)}</tbody>
</table>
<div class="totals">
  <div class="total-row grand-total"><span>Customer Materials Est:</span><span>$${Number(estimate.total_customer_materials ?? 0).toFixed(2)}</span></div>
</div>
` : ''}

</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { estimate_id } = await req.json()
  if (!estimate_id) {
    return new Response(JSON.stringify({ error: 'Missing estimate_id' }), { status: 400 })
  }

  const [{ data: estimate }, { data: items }] = await Promise.all([
    supabase.from('estimates').select('*').eq('id', estimate_id).single(),
    supabase.from('estimate_line_items').select('*').eq('estimate_id', estimate_id).order('supplied_by', { ascending: false }),
  ])

  if (!estimate) {
    return new Response(JSON.stringify({ error: 'Estimate not found' }), { status: 404 })
  }

  const [{ data: lead }, { data: brand }] = await Promise.all([
    supabase.from('leads').select('full_name, property_address').eq('id', estimate.lead_id).single(),
    supabase.from('brand_settings').select('primary_color, company_name:clients(company_name)').eq('client_id', estimate.client_id).single(),
  ])

  const html = buildHtml(estimate, items ?? [], lead, {
    primary_color: (brand as any)?.primary_color,
    company_name: (brand as any)?.company_name?.company_name,
  })

  const pdfApiUrl = Deno.env.get('PDFSHIFT_API_URL') ?? 'https://api.pdfshift.io/v3/convert/pdf'
  const pdfApiKey = Deno.env.get('PDFSHIFT_API_KEY')

  if (!pdfApiKey) {
    // Return HTML for preview if no PDF service configured
    return new Response(html, { headers: { 'Content-Type': 'text/html' } })
  }

  const pdfRes = await fetch(pdfApiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${btoa(`api:${pdfApiKey}`)}`,
    },
    body: JSON.stringify({ source: html, landscape: false, format: 'Letter' }),
  })

  if (!pdfRes.ok) {
    return new Response(JSON.stringify({ error: 'PDF generation failed' }), { status: 502 })
  }

  const pdfBytes = await pdfRes.arrayBuffer()
  const path = `estimates/${estimate_id}/estimate.pdf`

  await supabase.storage.from('job-files').upload(path, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  })

  const { data: { publicUrl } } = supabase.storage.from('job-files').getPublicUrl(path)

  await supabase.from('estimates').update({ pdf_url: publicUrl }).eq('id', estimate_id)

  return new Response(JSON.stringify({ pdf_url: publicUrl }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
