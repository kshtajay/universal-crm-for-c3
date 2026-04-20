import { useState, useEffect } from 'react'
import { Plus, AlertCircle, CheckCircle, XCircle } from 'lucide-react'
import { supabase } from '../../../integrations/supabase/client'

interface ChangeOrder {
  id: string
  title: string
  description: string | null
  amount: number
  status: string
  created_at: string
  approved_at: string | null
}

interface Props {
  leadId: string
  clientId: string
}

const STATUS_CONFIG: Record<string, { label: string; cls: string; Icon: React.ElementType }> = {
  pending: { label: 'Pending', cls: 'bg-amber-500/20 text-amber-400', Icon: AlertCircle },
  approved: { label: 'Approved', cls: 'bg-green-500/20 text-green-400', Icon: CheckCircle },
  rejected: { label: 'Rejected', cls: 'bg-red-500/20 text-red-400', Icon: XCircle },
}

export function ChangeOrderTab({ leadId, clientId }: Props) {
  const [orders, setOrders] = useState<ChangeOrder[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ title: '', description: '', amount: '' })

  useEffect(() => {
    supabase
      .from('change_orders')
      .select('id, title, description, amount, status, created_at, approved_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setOrders((data ?? []) as ChangeOrder[])
        setLoading(false)
      })
  }, [leadId])

  const addOrder = async () => {
    if (!form.title.trim() || !form.amount) return
    setSaving(true)
    const { data } = await supabase
      .from('change_orders')
      .insert({
        lead_id: leadId,
        client_id: clientId,
        title: form.title,
        description: form.description || null,
        amount: Number(form.amount),
        status: 'pending',
      })
      .select('id, title, description, amount, status, created_at, approved_at')
      .single()
    if (data) setOrders(prev => [data as ChangeOrder, ...prev])
    setForm({ title: '', description: '', amount: '' })
    setShowForm(false)
    setSaving(false)
  }

  const setStatus = async (id: string, status: string) => {
    const updates: Record<string, string | null> = { status }
    if (status === 'approved') updates.approved_at = new Date().toISOString()
    await supabase.from('change_orders').update(updates).eq('id', id)
    setOrders(prev => prev.map(o => o.id === id ? { ...o, ...updates } as ChangeOrder : o))
  }

  const approvedTotal = orders.filter(o => o.status === 'approved').reduce((s, o) => s + Number(o.amount), 0)

  if (loading) return (
    <div className="p-5 space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-secondary rounded-lg" />)}
    </div>
  )

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Change Orders</p>
          {approvedTotal > 0 && (
            <p className="text-xs text-green-400 mt-0.5">+${approvedTotal.toLocaleString()} approved</p>
          )}
        </div>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" />
          New CO
        </button>
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-secondary rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Change Order</p>
          <input
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Title"
            value={form.title}
            onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
          />
          <textarea
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[60px] resize-none"
            placeholder="Description (optional)"
            value={form.description}
            onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
          />
          <input
            type="number"
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Amount $ (use negative for credits)"
            step={0.01}
            value={form.amount}
            onChange={e => setForm(p => ({ ...p, amount: e.target.value }))}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent">Cancel</button>
            <button
              onClick={addOrder}
              disabled={saving || !form.title.trim() || !form.amount}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Create CO'}
            </button>
          </div>
        </div>
      )}

      {/* Order list */}
      {orders.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">No change orders</p>
      ) : (
        <div className="space-y-3">
          {orders.map(order => {
            const cfg = STATUS_CONFIG[order.status] ?? STATUS_CONFIG.pending
            return (
              <div key={order.id} className="bg-secondary rounded-lg p-4 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{order.title}</p>
                    {order.description && <p className="text-xs text-muted-foreground mt-0.5">{order.description}</p>}
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className={`text-sm font-bold ${Number(order.amount) < 0 ? 'text-red-400' : ''}`}>
                      {Number(order.amount) < 0 ? '-' : '+'}${Math.abs(Number(order.amount)).toLocaleString()}
                    </span>
                    <span className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold ${cfg.cls}`}>
                      <cfg.Icon className="w-2.5 h-2.5" />
                      {cfg.label}
                    </span>
                  </div>
                </div>
                {order.status === 'pending' && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setStatus(order.id, 'approved')}
                      className="flex items-center gap-1 px-3 py-1 bg-green-500/20 text-green-400 rounded-lg text-xs font-medium hover:bg-green-500/30 transition-colors"
                    >
                      <CheckCircle className="w-3 h-3" /> Approve
                    </button>
                    <button
                      onClick={() => setStatus(order.id, 'rejected')}
                      className="flex items-center gap-1 px-3 py-1 bg-red-500/20 text-red-400 rounded-lg text-xs font-medium hover:bg-red-500/30 transition-colors"
                    >
                      <XCircle className="w-3 h-3" /> Reject
                    </button>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">
                  {new Date(order.created_at).toLocaleDateString()}
                  {order.approved_at && ` · Approved ${new Date(order.approved_at).toLocaleDateString()}`}
                </p>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
