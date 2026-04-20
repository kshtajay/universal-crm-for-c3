import { useState, useEffect } from 'react'
import { Plus, Trash2, Send, FileText } from 'lucide-react'
import { supabase } from '../../../integrations/supabase/client'

interface Estimate {
  id: string
  mode: string
  markup_pct: number
  tax_pct: number
  status: string
  total_contractor_amount: number
  total_customer_materials: number
}

interface LineItem {
  id: string
  description: string
  quantity: number
  unit: string
  unit_cost: number
  customer_unit_cost: number | null
  supplied_by: 'contractor' | 'customer'
}

interface Props {
  leadId: string
  clientId: string
}

const EMPTY_ITEM: { description: string; quantity: number; unit: string; unit_cost: number; customer_unit_cost: number; supplied_by: 'contractor' | 'customer' } = { description: '', quantity: 1, unit: 'ea', unit_cost: 0, customer_unit_cost: 0, supplied_by: 'contractor' }

export function EstimateTab({ leadId, clientId }: Props) {
  const [estimate, setEstimate] = useState<Estimate | null>(null)
  const [items, setItems] = useState<LineItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [newItem, setNewItem] = useState(EMPTY_ITEM)
  const [addingItem, setAddingItem] = useState(false)

  const load = async () => {
    const { data: est } = await supabase
      .from('estimates')
      .select('id, mode, markup_pct, tax_pct, status, total_contractor_amount, total_customer_materials')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (est) {
      setEstimate(est)
      const { data: lineItems } = await supabase
        .from('estimate_line_items')
        .select('id, description, quantity, unit, unit_cost, customer_unit_cost, supplied_by')
        .eq('estimate_id', est.id)
        .order('supplied_by', { ascending: false })
      setItems((lineItems ?? []) as LineItem[])
    }
    setLoading(false)
  }

  useEffect(() => { load() }, [leadId])

  const createEstimate = async () => {
    setSaving(true)
    const { data } = await supabase
      .from('estimates')
      .insert({ lead_id: leadId, client_id: clientId, mode: 'itemized', markup_pct: 0, tax_pct: 0, status: 'draft' })
      .select('id, mode, markup_pct, tax_pct, status, total_contractor_amount, total_customer_materials')
      .single()
    if (data) setEstimate(data)
    setSaving(false)
  }

  const addLineItem = async () => {
    if (!estimate || !newItem.description.trim()) return
    setAddingItem(true)
    const { data } = await supabase
      .from('estimate_line_items')
      .insert({
        estimate_id: estimate.id,
        client_id: clientId,
        description: newItem.description,
        quantity: newItem.quantity,
        unit: newItem.unit,
        unit_cost: newItem.unit_cost,
        customer_unit_cost: newItem.supplied_by === 'customer' ? newItem.customer_unit_cost : null,
        supplied_by: newItem.supplied_by,
      })
      .select('id, description, quantity, unit, unit_cost, customer_unit_cost, supplied_by')
      .single()
    if (data) {
      setItems(prev => [...prev, data as LineItem])
      setNewItem(EMPTY_ITEM)
      recalcTotals([...items, data as LineItem], estimate)
    }
    setAddingItem(false)
  }

  const removeItem = async (id: string) => {
    await supabase.from('estimate_line_items').delete().eq('id', id)
    const remaining = items.filter(i => i.id !== id)
    setItems(remaining)
    if (estimate) recalcTotals(remaining, estimate)
  }

  const recalcTotals = async (itemList: LineItem[], est: Estimate) => {
    const markup = 1 + (est.markup_pct ?? 0) / 100
    const tax = 1 + (est.tax_pct ?? 0) / 100
    const contractorTotal = itemList
      .filter(i => i.supplied_by === 'contractor')
      .reduce((s, i) => s + i.quantity * i.unit_cost * markup, 0) * tax
    const customerTotal = itemList
      .filter(i => i.supplied_by === 'customer')
      .reduce((s, i) => s + i.quantity * (i.customer_unit_cost ?? i.unit_cost), 0)

    await supabase
      .from('estimates')
      .update({ total_contractor_amount: contractorTotal, total_customer_materials: customerTotal })
      .eq('id', est.id)

    setEstimate(prev => prev ? { ...prev, total_contractor_amount: contractorTotal, total_customer_materials: customerTotal } : prev)
  }

  const sendEstimate = async () => {
    if (!estimate) return
    setSending(true)
    await supabase.from('estimates').update({ status: 'sent' }).eq('id', estimate.id)
    setEstimate(prev => prev ? { ...prev, status: 'sent' } : prev)
    // Fire automation: estimate sent
    await supabase.functions.invoke('run-automation', {
      body: { event_type: 'stage_change', lead_id: leadId, client_id: clientId, payload: { new_stage: 'estimate_sent' } },
    })
    setSending(false)
  }

  const contractorItems = items.filter(i => i.supplied_by === 'contractor')
  const customerItems = items.filter(i => i.supplied_by === 'customer')

  if (loading) return (
    <div className="p-5 space-y-3 animate-pulse">
      {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-secondary rounded-lg" />)}
    </div>
  )

  if (!estimate) return (
    <div className="p-5 flex flex-col items-center justify-center py-16 gap-4">
      <FileText className="w-10 h-10 text-muted-foreground" />
      <p className="text-muted-foreground text-sm">No estimate yet</p>
      <button
        onClick={createEstimate}
        disabled={saving}
        className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {saving ? 'Creating…' : 'Create Estimate'}
      </button>
    </div>
  )

  return (
    <div className="p-5 space-y-5">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
          estimate.status === 'approved' ? 'bg-green-500/20 text-green-400'
          : estimate.status === 'sent' ? 'bg-blue-500/20 text-blue-400'
          : 'bg-secondary text-muted-foreground'
        }`}>
          {estimate.status}
        </span>
        {estimate.status === 'draft' && (
          <button
            onClick={sendEstimate}
            disabled={sending || items.length === 0}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Send className="w-3.5 h-3.5" />
            {sending ? 'Sending…' : 'Send Estimate'}
          </button>
        )}
      </div>

      {/* Section A — Contractor charges */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
          Section A — Contractor Charges
        </p>
        <div className="space-y-1.5">
          {contractorItems.length === 0 && (
            <p className="text-muted-foreground text-xs py-3 text-center">No contractor items yet</p>
          )}
          {contractorItems.map(item => (
            <div key={item.id} className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{item.description}</p>
                <p className="text-xs text-muted-foreground">{item.quantity} × {item.unit} @ ${item.unit_cost}</p>
              </div>
              <span className="text-sm font-semibold shrink-0">${(item.quantity * item.unit_cost).toFixed(2)}</span>
              <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive ml-1">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
        <div className="text-right mt-2">
          <span className="text-sm font-bold">
            Subtotal: ${(estimate.total_contractor_amount).toFixed(2)}
          </span>
        </div>
      </div>

      {/* Section B — Customer shopping list */}
      {customerItems.length > 0 && (
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
            Section B — Customer Shopping List
          </p>
          <div className="space-y-1.5">
            {customerItems.map(item => (
              <div key={item.id} className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{item.description}</p>
                  <p className="text-xs text-muted-foreground">{item.quantity} {item.unit} — Customer buys</p>
                </div>
                <span className="text-sm font-semibold shrink-0">${((item.customer_unit_cost ?? item.unit_cost) * item.quantity).toFixed(2)}</span>
                <button onClick={() => removeItem(item.id)} className="text-muted-foreground hover:text-destructive ml-1">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
          <div className="text-right mt-2">
            <span className="text-sm font-bold">
              Materials est: ${estimate.total_customer_materials.toFixed(2)}
            </span>
          </div>
        </div>
      )}

      {/* Add line item */}
      {estimate.status === 'draft' && (
        <div className="bg-secondary rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Add Line Item</p>
          <div className="grid grid-cols-2 gap-2">
            <input
              className="col-span-2 bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Description"
              value={newItem.description}
              onChange={e => setNewItem(p => ({ ...p, description: e.target.value }))}
            />
            <div className="flex gap-1">
              <input
                type="number"
                className="w-16 bg-card border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Qty"
                value={newItem.quantity}
                min={0.01}
                step={0.01}
                onChange={e => setNewItem(p => ({ ...p, quantity: Number(e.target.value) }))}
              />
              <input
                className="flex-1 bg-card border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="Unit"
                value={newItem.unit}
                onChange={e => setNewItem(p => ({ ...p, unit: e.target.value }))}
              />
            </div>
            <input
              type="number"
              className="bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Unit cost $"
              value={newItem.unit_cost || ''}
              min={0}
              step={0.01}
              onChange={e => setNewItem(p => ({ ...p, unit_cost: Number(e.target.value) }))}
            />
          </div>
          <div className="flex items-center gap-3">
            <select
              className="flex-1 bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={newItem.supplied_by}
              onChange={e => setNewItem(p => ({ ...p, supplied_by: e.target.value as 'contractor' | 'customer' }))}
            >
              <option value="contractor">Contractor supplies</option>
              <option value="customer">Customer buys</option>
            </select>
            <button
              onClick={addLineItem}
              disabled={addingItem || !newItem.description.trim()}
              className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              <Plus className="w-3.5 h-3.5" />
              Add
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
