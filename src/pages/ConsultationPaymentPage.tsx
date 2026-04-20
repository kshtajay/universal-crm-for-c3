import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../integrations/supabase/client'

interface Config {
  company_name: string
  logo_url: string | null
  primary_color: string
  deposit_type: string
  deposit_amount: number | null
  deposit_pct: number | null
  fee_label: string
}

export function ConsultationPaymentPage() {
  const { slug } = useParams<{ slug: string }>()
  const [config, setConfig] = useState<Config | null>(null)
  const [loading, setLoading] = useState(true)
  const [paying, setPaying] = useState(false)
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!slug) return
    Promise.all([
      supabase.from('clients').select('id, company_name').eq('slug', slug).single(),
    ]).then(async ([{ data: client }]) => {
      if (!client) { setLoading(false); return }

      const [{ data: brand }, { data: rule }] = await Promise.all([
        supabase.from('brand_settings').select('logo_url, primary_color').eq('client_id', client.id).single(),
        supabase.from('deposit_rules').select('deposit_type, deposit_amount, deposit_pct').eq('client_id', client.id).eq('is_active', true).single(),
      ])

      setConfig({
        company_name: client.company_name,
        logo_url: brand?.logo_url ?? null,
        primary_color: brand?.primary_color ?? '#F5C542',
        deposit_type: rule?.deposit_type ?? 'fixed',
        deposit_amount: rule?.deposit_amount ?? 150,
        deposit_pct: rule?.deposit_pct ?? null,
        fee_label: 'Consultation Fee',
      })
      setLoading(false)
    })
  }, [slug])

  const displayAmount = config
    ? config.deposit_type === 'fixed'
      ? `$${Number(config.deposit_amount ?? 0).toFixed(2)}`
      : `${config.deposit_pct ?? 0}% deposit`
    : ''

  const handlePay = async () => {
    if (!name.trim() || !email.trim()) { setError('Please enter your name and email.'); return }
    setError(null)
    setPaying(true)

    try {
      // Create a lead + invoice via edge function, then redirect to Stripe
      const { data: clientRow } = await supabase.from('clients').select('id').eq('slug', slug!).single()
      if (!clientRow) throw new Error('Client not found')

      // Insert lead
      const { data: lead } = await supabase
        .from('leads')
        .insert({ client_id: clientRow.id, full_name: name, email, pipeline_stage: 'new' })
        .select('id')
        .single()

      if (!lead) throw new Error('Failed to create lead')

      // Create invoice via edge function
      const { data: inv } = await supabase.functions.invoke('create-stripe-invoice', {
        body: { lead_id: lead.id, client_id: clientRow.id, type: 'deposit' },
      })

      if (inv?.payment_url) {
        window.location.href = inv.payment_url
      } else {
        throw new Error('Payment link not available')
      }
    } catch (err: any) {
      setError(err.message ?? 'Payment failed. Please try again.')
      setPaying(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  if (!config) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <p className="text-muted-foreground">Booking page not found.</p>
    </div>
  )

  const gold = config.primary_color

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-md space-y-6">
        {/* Brand header */}
        <div className="text-center space-y-3">
          {config.logo_url ? (
            <img src={config.logo_url} alt={config.company_name} className="w-16 h-16 rounded-xl object-cover mx-auto" />
          ) : (
            <div className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto" style={{ background: gold + '33' }}>
              <span className="text-2xl font-black" style={{ color: gold }}>{config.company_name.charAt(0)}</span>
            </div>
          )}
          <p className="font-black text-sm uppercase tracking-widest">{config.company_name}</p>
        </div>

        <div className="bg-card border border-border rounded-2xl p-6 space-y-5">
            {/* Amount */}
            <div className="text-center py-4 border-b border-border">
              <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest mb-1">{config.fee_label}</p>
              <p className="text-4xl font-black">{displayAmount}</p>
              <p className="text-xs text-muted-foreground mt-1">Secure payment via Stripe</p>
            </div>

            {/* Fields */}
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Full Name</label>
                <input
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="Jane Smith"
                  value={name}
                  onChange={e => setName(e.target.value)}
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-muted-foreground uppercase tracking-wide block mb-1">Email</label>
                <input
                  type="email"
                  className="w-full bg-secondary border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  placeholder="jane@example.com"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                />
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">{error}</p>
            )}

            <button
              onClick={handlePay}
              disabled={paying}
              className="w-full py-3 rounded-xl text-sm font-bold transition-opacity disabled:opacity-40 hover:opacity-90"
              style={{ background: gold, color: '#0A1628' }}
            >
              {paying ? 'Redirecting to payment…' : `Pay ${displayAmount} →`}
            </button>

            <p className="text-[10px] text-muted-foreground text-center">
              You'll be redirected to Stripe's secure payment page. Your card details are never stored by us.
            </p>
        </div>
      </div>
    </div>
  )
}
