import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Stripe from 'https://esm.sh/stripe@14?target=deno'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const stripe = new Stripe(Deno.env.get('STRIPE_SECRET_KEY')!, {
  apiVersion: '2024-06-20',
  httpClient: Stripe.createFetchHttpClient(),
})

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { lead_id, client_id, type = 'deposit', amount } = await req.json()

  if (!lead_id || !client_id) {
    return new Response(JSON.stringify({ error: 'Missing lead_id or client_id' }), { status: 400 })
  }

  // Fetch lead for customer info
  const { data: lead, error: leadError } = await supabase
    .from('leads')
    .select('full_name, email')
    .eq('id', lead_id)
    .single()

  if (leadError || !lead) {
    return new Response(JSON.stringify({ error: 'Lead not found' }), { status: 404 })
  }

  // Fetch or create Stripe customer
  const { data: clientRow } = await supabase
    .from('clients')
    .select('company_name, stripe_customer_id')
    .eq('id', client_id)
    .single()

  let stripeCustomerId: string | undefined = (clientRow as any)?.stripe_customer_id

  if (!stripeCustomerId) {
    const customer = await stripe.customers.create({
      name: lead.full_name,
      email: lead.email,
      metadata: { lead_id, client_id },
    })
    stripeCustomerId = customer.id

    await supabase
      .from('clients')
      .update({ stripe_customer_id: stripeCustomerId })
      .eq('id', client_id)
  }

  // Determine amount in cents
  let amountCents: number
  if (amount) {
    amountCents = Math.round(Number(amount) * 100)
  } else {
    // Fetch from deposit_rules if no amount provided
    const { data: rule } = await supabase
      .from('deposit_rules')
      .select('deposit_type, deposit_amount, deposit_pct')
      .eq('client_id', client_id)
      .single()

    if (rule?.deposit_type === 'fixed') {
      amountCents = Math.round(Number(rule.deposit_amount) * 100)
    } else if (rule?.deposit_type === 'percentage') {
      // Fallback to a minimum if no estimate total available
      amountCents = Math.round(Number(rule.deposit_pct ?? 25) * 100)
    } else {
      amountCents = 25000 // $250 default deposit
    }
  }

  const description = type === 'deposit'
    ? `Deposit — ${(clientRow as any)?.company_name ?? 'Service'}`
    : `Full payment — ${(clientRow as any)?.company_name ?? 'Service'}`

  // Create Stripe invoice
  const invoice = await stripe.invoices.create({
    customer: stripeCustomerId,
    auto_advance: false,
    metadata: { lead_id, client_id, type },
  })

  await stripe.invoiceItems.create({
    customer: stripeCustomerId,
    invoice: invoice.id,
    amount: amountCents,
    currency: 'usd',
    description,
  })

  const finalized = await stripe.invoices.finalizeInvoice(invoice.id)
  const paymentUrl = finalized.hosted_invoice_url ?? ''

  // Upsert invoice record
  const { data: existingInvoice } = await supabase
    .from('invoices')
    .select('id')
    .eq('lead_id', lead_id)
    .eq('invoice_type', type)
    .single()

  if (existingInvoice) {
    await supabase
      .from('invoices')
      .update({ stripe_invoice_id: finalized.id, payment_url: paymentUrl, status: 'sent' })
      .eq('id', existingInvoice.id)
  } else {
    await supabase.from('invoices').insert({
      lead_id,
      client_id,
      invoice_type: type,
      amount: amountCents / 100,
      stripe_invoice_id: finalized.id,
      payment_url: paymentUrl,
      status: 'sent',
    })
  }

  return new Response(JSON.stringify({ invoice_id: finalized.id, payment_url: paymentUrl }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
