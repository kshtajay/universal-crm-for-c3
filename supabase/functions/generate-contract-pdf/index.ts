import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

function buildHtml(contract: any, lead: any, brand: any): string {
  const gold = brand?.primary_color ?? '#F5C542'

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<style>
  body { font-family: Georgia, serif; margin: 0; padding: 48px; color: #111; font-size: 13px; line-height: 1.7; }
  .header { border-bottom: 3px solid ${gold}; padding-bottom: 16px; margin-bottom: 32px; }
  .company { font-family: Arial, sans-serif; font-size: 22px; font-weight: 900; text-transform: uppercase; }
  .meta { color: #666; font-size: 12px; font-family: Arial, sans-serif; }
  .section-title { font-family: Arial, sans-serif; font-size: 11px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 1px; color: #666; margin: 24px 0 8px; border-bottom: 1px solid #eee; padding-bottom: 4px; }
  .terms { white-space: pre-wrap; }
  .sig-section { margin-top: 48px; display: flex; gap: 48px; }
  .sig-box { flex: 1; }
  .sig-line { border-top: 1px solid #111; padding-top: 4px; font-size: 11px; color: #666; margin-top: 48px; }
  .sig-img { max-height: 64px; margin-top: 8px; }
  .status { display: inline-block; padding: 4px 12px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase;
    font-family: Arial, sans-serif;
    background: ${contract.status === 'signed' ? '#d1fae5' : contract.status === 'sent' ? '#dbeafe' : '#f3f4f6'};
    color: ${contract.status === 'signed' ? '#065f46' : contract.status === 'sent' ? '#1e40af' : '#374151'}; }
</style>
</head>
<body>
<div class="header">
  <div class="company">${brand?.company_name ?? 'Contractor'}</div>
  <div class="meta" style="margin-top:4px">SERVICE CONTRACT &nbsp;·&nbsp; <span class="status">${contract.status}</span></div>
  <div class="meta" style="margin-top:8px">
    <strong>Client:</strong> ${lead?.full_name ?? 'N/A'} &nbsp;|&nbsp;
    <strong>Date:</strong> ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
  </div>
</div>

<div class="section-title">Terms &amp; Conditions</div>
<div class="terms">${contract.terms_text ?? ''}</div>

<div class="sig-section">
  <div class="sig-box">
    <div class="section-title">Contractor Signature</div>
    <div class="sig-line">${brand?.company_name ?? 'Contractor'}</div>
  </div>
  <div class="sig-box">
    <div class="section-title">Client Signature</div>
    ${contract.signature_image_url
      ? `<img src="${contract.signature_image_url}" class="sig-img" alt="Client signature" />`
      : '<div style="height:48px;border-bottom:1px solid #ccc;"></div>'
    }
    <div class="sig-line">
      ${lead?.full_name ?? 'Client'}
      ${contract.signed_at ? ` — Signed ${new Date(contract.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}` : ''}
    </div>
  </div>
</div>
</body>
</html>`
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { contract_id } = await req.json()
  if (!contract_id) {
    return new Response(JSON.stringify({ error: 'Missing contract_id' }), { status: 400 })
  }

  const { data: contract } = await supabase
    .from('contracts')
    .select('*')
    .eq('id', contract_id)
    .single()

  if (!contract) {
    return new Response(JSON.stringify({ error: 'Contract not found' }), { status: 404 })
  }

  const [{ data: lead }, { data: brand }] = await Promise.all([
    supabase.from('leads').select('full_name').eq('id', contract.lead_id).single(),
    supabase.from('brand_settings').select('primary_color, clients(company_name)').eq('client_id', contract.client_id).single(),
  ])

  const html = buildHtml(contract, lead, {
    primary_color: (brand as any)?.primary_color,
    company_name: (brand as any)?.clients?.company_name,
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
  const path = `contracts/${contract_id}/contract.pdf`

  await supabase.storage.from('job-files').upload(path, pdfBytes, {
    contentType: 'application/pdf',
    upsert: true,
  })

  const { data: { publicUrl } } = supabase.storage.from('job-files').getPublicUrl(path)
  await supabase.from('contracts').update({ pdf_url: publicUrl }).eq('id', contract_id)

  return new Response(JSON.stringify({ pdf_url: publicUrl }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
