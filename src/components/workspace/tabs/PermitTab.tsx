import { useState, useEffect } from 'react'
import { Plus, ClipboardCheck } from 'lucide-react'
import { supabase } from '../../../integrations/supabase/client'

interface Permit {
  id: string
  permit_type: string
  status: string
  permit_number: string | null
  submitted_at: string | null
  approved_at: string | null
  notes: string | null
}

interface Props {
  leadId: string
  clientId: string
}

const STATUS_ORDER = ['not_applied', 'applied', 'under_review', 'approved', 'rejected']

const STATUS_STYLES: Record<string, string> = {
  not_applied: 'bg-secondary text-muted-foreground',
  applied: 'bg-blue-500/20 text-blue-400',
  under_review: 'bg-amber-500/20 text-amber-400',
  approved: 'bg-green-500/20 text-green-400',
  rejected: 'bg-red-500/20 text-red-400',
}

export function PermitTab({ leadId, clientId }: Props) {
  const [permits, setPermits] = useState<Permit[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({ permit_type: '', notes: '' })

  useEffect(() => {
    supabase
      .from('permits')
      .select('id, permit_type, status, permit_number, submitted_at, approved_at, notes')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setPermits((data ?? []) as Permit[])
        setLoading(false)
      })
  }, [leadId])

  const addPermit = async () => {
    if (!form.permit_type.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('permits')
      .insert({ lead_id: leadId, client_id: clientId, permit_type: form.permit_type, status: 'not_applied', notes: form.notes || null })
      .select('id, permit_type, status, permit_number, submitted_at, approved_at, notes')
      .single()
    if (data) setPermits(prev => [data as Permit, ...prev])
    setForm({ permit_type: '', notes: '' })
    setShowForm(false)
    setSaving(false)
  }

  const updateStatus = async (id: string, status: string) => {
    const updates: Record<string, string | null> = { status }
    if (status === 'applied') updates.submitted_at = new Date().toISOString()
    if (status === 'approved') updates.approved_at = new Date().toISOString()
    await supabase.from('permits').update(updates).eq('id', id)
    setPermits(prev => prev.map(p => p.id === id ? { ...p, ...updates } as Permit : p))
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
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Permits</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" />
          Add Permit
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-secondary rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Permit</p>
          <input
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Permit type (e.g. Building, Electrical, Plumbing)"
            value={form.permit_type}
            onChange={e => setForm(p => ({ ...p, permit_type: e.target.value }))}
          />
          <textarea
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[60px] resize-none"
            placeholder="Notes (optional)"
            value={form.notes}
            onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
          />
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent">
              Cancel
            </button>
            <button
              onClick={addPermit}
              disabled={saving || !form.permit_type.trim()}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              {saving ? 'Adding…' : 'Add'}
            </button>
          </div>
        </div>
      )}

      {/* Permit list */}
      {permits.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <ClipboardCheck className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">No permits tracked yet</p>
        </div>
      ) : (
        <div className="space-y-3">
          {permits.map(permit => (
            <div key={permit.id} className="bg-secondary rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold">{permit.permit_type}</p>
                <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase ${STATUS_STYLES[permit.status] ?? ''}`}>
                  {permit.status.replace(/_/g, ' ')}
                </span>
              </div>
              {permit.permit_number && (
                <p className="text-xs text-muted-foreground">Permit #{permit.permit_number}</p>
              )}
              {permit.notes && <p className="text-xs text-muted-foreground">{permit.notes}</p>}
              <div className="flex items-center gap-1 flex-wrap">
                {STATUS_ORDER.filter(s => s !== permit.status).map(s => (
                  <button
                    key={s}
                    onClick={() => updateStatus(permit.id, s)}
                    className="px-2.5 py-1 rounded-lg text-[10px] font-medium border border-border hover:bg-accent transition-colors capitalize"
                  >
                    → {s.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
