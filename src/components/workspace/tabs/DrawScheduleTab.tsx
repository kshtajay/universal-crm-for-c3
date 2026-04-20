import { useState, useEffect } from 'react'
import { Plus, DollarSign } from 'lucide-react'
import { supabase } from '../../../integrations/supabase/client'

interface DrawSchedule {
  id: string
  title: string
  total_amount: number
}

interface DrawItem {
  id: string
  milestone_name: string
  amount: number
  status: string
  released_at: string | null
  sort_order: number
}

interface Props {
  leadId: string
  clientId: string
}

const ITEM_STATUSES = ['pending', 'requested', 'approved', 'released']

const STATUS_STYLES: Record<string, string> = {
  pending: 'bg-secondary text-muted-foreground',
  requested: 'bg-blue-500/20 text-blue-400',
  approved: 'bg-amber-500/20 text-amber-400',
  released: 'bg-green-500/20 text-green-400',
}

export function DrawScheduleTab({ leadId, clientId }: Props) {
  const [schedule, setSchedule] = useState<DrawSchedule | null>(null)
  const [items, setItems] = useState<DrawItem[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showItemForm, setShowItemForm] = useState(false)
  const [itemForm, setItemForm] = useState({ milestone_name: '', amount: '' })

  useEffect(() => {
    supabase
      .from('draw_schedules')
      .select('id, title, total_amount')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(async ({ data: sched }) => {
        if (sched) {
          setSchedule(sched)
          const { data: drawItems } = await supabase
            .from('draw_schedule_items')
            .select('id, milestone_name, amount, status, released_at, sort_order')
            .eq('draw_schedule_id', sched.id)
            .order('sort_order', { ascending: true })
          setItems((drawItems ?? []) as DrawItem[])
        }
        setLoading(false)
      })
  }, [leadId])

  const createSchedule = async () => {
    setSaving(true)
    const { data } = await supabase
      .from('draw_schedules')
      .insert({ lead_id: leadId, client_id: clientId, title: 'Draw Schedule', total_amount: 0, status: 'draft' })
      .select('id, title, total_amount')
      .single()
    if (data) setSchedule(data)
    setSaving(false)
  }

  const addItem = async () => {
    if (!schedule || !itemForm.milestone_name.trim() || !itemForm.amount) return
    setSaving(true)
    const { data } = await supabase
      .from('draw_schedule_items')
      .insert({
        draw_schedule_id: schedule.id,
        milestone_name: itemForm.milestone_name,
        amount: Number(itemForm.amount),
        status: 'pending',
        sort_order: items.length + 1,
      })
      .select('id, milestone_name, amount, status, released_at, sort_order')
      .single()
    if (data) {
      const newItems = [...items, data as DrawItem]
      setItems(newItems)
      const total = newItems.reduce((s, i) => s + Number(i.amount), 0)
      await supabase.from('draw_schedules').update({ total_amount: total }).eq('id', schedule.id)
      setSchedule(prev => prev ? { ...prev, total_amount: total } : prev)
    }
    setItemForm({ milestone_name: '', amount: '' })
    setShowItemForm(false)
    setSaving(false)
  }

  const updateItemStatus = async (id: string, status: string) => {
    const updates: Record<string, string | null> = { status }
    if (status === 'released') updates.released_at = new Date().toISOString()
    await supabase.from('draw_schedule_items').update(updates).eq('id', id)
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updates } as DrawItem : i))
  }

  if (loading) return (
    <div className="p-5 space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => <div key={i} className="h-14 bg-secondary rounded-lg" />)}
    </div>
  )

  if (!schedule) return (
    <div className="p-5 flex flex-col items-center justify-center py-16 gap-4">
      <DollarSign className="w-10 h-10 text-muted-foreground" />
      <p className="text-muted-foreground text-sm">No draw schedule yet</p>
      <button
        onClick={createSchedule}
        disabled={saving}
        className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40"
      >
        {saving ? 'Creating…' : 'Create Draw Schedule'}
      </button>
    </div>
  )

  const released = items.filter(i => i.status === 'released').reduce((s, i) => s + Number(i.amount), 0)

  return (
    <div className="p-5 space-y-5">
      {/* Summary */}
      <div className="bg-secondary rounded-xl p-4 flex items-center justify-between">
        <div>
          <p className="text-xs text-muted-foreground uppercase font-bold tracking-wide mb-1">{schedule.title}</p>
          <p className="text-2xl font-black">${Number(schedule.total_amount).toLocaleString()}</p>
        </div>
        <div className="text-right">
          <p className="text-xs text-muted-foreground mb-0.5">Released</p>
          <p className="text-lg font-bold text-green-400">${released.toLocaleString()}</p>
          <p className="text-xs text-muted-foreground">Remaining: ${(Number(schedule.total_amount) - released).toLocaleString()}</p>
        </div>
      </div>

      {/* Items */}
      <div className="space-y-2">
        {items.map((item, idx) => (
          <div key={item.id} className="bg-secondary rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-card text-xs font-bold flex items-center justify-center shrink-0">{idx + 1}</span>
                <p className="text-sm font-medium">{item.milestone_name}</p>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold">${Number(item.amount).toLocaleString()}</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${STATUS_STYLES[item.status] ?? ''}`}>
                  {item.status}
                </span>
              </div>
            </div>
            {item.status !== 'released' && (
              <div className="flex gap-1 flex-wrap">
                {ITEM_STATUSES.filter(s => s !== item.status).map(s => (
                  <button
                    key={s}
                    onClick={() => updateItemStatus(item.id, s)}
                    className="px-2 py-0.5 rounded text-[10px] font-medium border border-border hover:bg-accent transition-colors capitalize"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
            {item.released_at && (
              <p className="text-xs text-green-400">Released {new Date(item.released_at).toLocaleDateString()}</p>
            )}
          </div>
        ))}
      </div>

      {/* Add item form */}
      {showItemForm ? (
        <div className="bg-secondary rounded-xl p-4 space-y-3">
          <input
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Milestone name (e.g. Foundation Complete)"
            value={itemForm.milestone_name}
            onChange={e => setItemForm(p => ({ ...p, milestone_name: e.target.value }))}
          />
          <input
            type="number"
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Amount $"
            min={0}
            step={0.01}
            value={itemForm.amount}
            onChange={e => setItemForm(p => ({ ...p, amount: e.target.value }))}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowItemForm(false)} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent">Cancel</button>
            <button
              onClick={addItem}
              disabled={saving || !itemForm.milestone_name.trim() || !itemForm.amount}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              {saving ? 'Adding…' : 'Add Milestone'}
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => setShowItemForm(true)}
          className="w-full flex items-center justify-center gap-2 py-2.5 border border-dashed border-border rounded-lg text-sm text-muted-foreground hover:text-foreground hover:border-foreground transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Milestone
        </button>
      )}
    </div>
  )
}
