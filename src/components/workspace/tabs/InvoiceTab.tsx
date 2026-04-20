import { useState, useEffect } from 'react'
import { Receipt, ExternalLink, Plus } from 'lucide-react'
import { supabase } from '../../../integrations/supabase/client'

interface Invoice {
  id: string
  type: string
  amount: number
  status: string
  stripe_payment_url: string | null
  paid_at: string | null
  created_at: string
}

interface Props {
  leadId: string
  clientId: string
}

const STATUS_STYLES: Record<string, string> = {
  paid: 'bg-green-500/20 text-green-400',
  pending: 'bg-amber-500/20 text-amber-400',
  failed: 'bg-red-500/20 text-red-400',
}

export function InvoiceTab({ leadId, clientId }: Props) {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ type: 'deposit' as 'deposit' | 'full', amount: '' })

  useEffect(() => {
    supabase
      .from('invoices')
      .select('id, type, amount, status, stripe_payment_url, paid_at, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setInvoices((data ?? []) as Invoice[])
        setLoading(false)
      })
  }, [leadId])

  const createInvoice = async () => {
    if (!form.amount || Number(form.amount) <= 0) return
    setCreating(true)
    try {
      const { data } = await supabase.functions.invoke('create-stripe-invoice', {
        body: { lead_id: leadId, client_id: clientId, type: form.type, amount: Number(form.amount) },
      })
      if (data?.invoice_id) {
        const { data: inv } = await supabase
          .from('invoices')
          .select('id, type, amount, status, stripe_payment_url, paid_at, created_at')
          .eq('id', data.invoice_id)
          .single()
        if (inv) setInvoices(prev => [inv as Invoice, ...prev])
      }
      setShowForm(false)
      setForm({ type: 'deposit', amount: '' })
    } finally {
      setCreating(false)
    }
  }

  if (loading) return (
    <div className="p-5 space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-secondary rounded-lg" />)}
    </div>
  )

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Invoices</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" />
          New Invoice
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="bg-secondary rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Create Invoice</p>
          <div className="flex gap-2">
            <select
              className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.type}
              onChange={e => setForm(p => ({ ...p, type: e.target.value as 'deposit' | 'full' }))}
            >
              <option value="deposit">Deposit</option>
              <option value="full">Full Payment</option>
            </select>
            <input
              type="number"
              className="w-32 bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Amount $"
              value={form.amount}
              min={1}
              step={0.01}
              onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
            />
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent">
              Cancel
            </button>
            <button
              onClick={createInvoice}
              disabled={creating || !form.amount}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              {creating ? 'Creating…' : 'Create & Send'}
            </button>
          </div>
        </div>
      )}

      {/* Invoice list */}
      {invoices.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <Receipt className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">No invoices yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {invoices.map(inv => (
            <div key={inv.id} className="flex items-center gap-3 px-3 py-3 bg-secondary rounded-lg">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-0.5">
                  <p className="text-sm font-medium capitalize">{inv.type}</p>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[inv.status] ?? 'bg-secondary text-muted-foreground'}`}>
                    {inv.status}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {inv.paid_at
                    ? `Paid ${new Date(inv.paid_at).toLocaleDateString()}`
                    : new Date(inv.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="text-sm font-bold shrink-0">${Number(inv.amount).toFixed(2)}</span>
              {inv.stripe_payment_url && inv.status === 'pending' && (
                <a
                  href={inv.stripe_payment_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-xs font-medium hover:opacity-90"
                >
                  <ExternalLink className="w-3 h-3" />
                  Pay
                </a>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Total summary */}
      {invoices.length > 0 && (
        <div className="border-t border-border pt-3 space-y-1">
          {[
            { label: 'Total Invoiced', val: invoices.reduce((s, i) => s + Number(i.amount), 0) },
            { label: 'Total Paid', val: invoices.filter(i => i.status === 'paid').reduce((s, i) => s + Number(i.amount), 0) },
            { label: 'Outstanding', val: invoices.filter(i => i.status === 'pending').reduce((s, i) => s + Number(i.amount), 0) },
          ].map(({ label, val }) => (
            <div key={label} className="flex justify-between text-sm">
              <span className="text-muted-foreground">{label}</span>
              <span className="font-semibold">${val.toFixed(2)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
