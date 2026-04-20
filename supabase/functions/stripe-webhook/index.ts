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

  const signature = req.headers.get('stripe-signature')
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET')

  if (!signature || !webhookSecret) {
    return new Response('Missing signature or webhook secret', { status: 400 })
  }

  const body = await req.text()

  let event: Stripe.Event
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, webhookSecret)
  } catch (err) {
    return new Response(`Webhook signature verification failed: ${err}`, { status: 400 })
  }

  switch (event.type) {
    case 'invoice.paid': {
      const invoice = event.data.object as Stripe.Invoice
      const paidAt = new Date(invoice.status_transitions.paid_at! * 1000).toISOString()
      await supabase
        .from('invoices')
        .update({ status: 'paid', paid_at: paidAt })
        .eq('stripe_invoice_id', invoice.id)

      // Fire automation for payment received
      const { data: inv } = await supabase
        .from('invoices')
        .select('lead_id, client_id')
        .eq('stripe_invoice_id', invoice.id)
        .single()

      if (inv) {
        await supabase.functions.invoke('run-automation', {
          body: {
            event_type: 'payment_received',
            lead_id: inv.lead_id,
            client_id: inv.client_id,
            payload: { stripe_invoice_id: invoice.id, amount: invoice.amount_paid / 100 },
          },
        })
      }
      break
    }

    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice
      await supabase
        .from('invoices')
        .update({ status: 'failed' })
        .eq('stripe_invoice_id', invoice.id)
      break
    }

    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session
      // Mark lead as deposit paid if metadata present
      const { lead_id, client_id } = session.metadata ?? {}
      if (lead_id && client_id) {
        await supabase
          .from('leads')
          .update({ pipeline_stage: 'deposit_paid' })
          .eq('id', lead_id)

        await supabase.functions.invoke('run-automation', {
          body: {
            event_type: 'stage_change',
            lead_id,
            client_id,
            payload: { new_stage: 'deposit_paid' },
          },
        })
      }
      break
    }

    default:
      // Unhandled event type — ignore
      break
  }

  return new Response(JSON.stringify({ received: true }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
