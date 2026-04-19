import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'

interface Props {
  onClose: () => void
  onCreated: (clientId: string) => void
}

export function CreateClientModal({ onClose, onCreated }: Props) {
  const [form, setForm] = useState({
    company_name: '',
    slug: '',
    contractor_type: '',
    contact_email: '',
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const set = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (field === 'company_name' && !form.slug) {
      setForm(prev => ({
        ...prev,
        company_name: value,
        slug: value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''),
      }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.company_name.trim() || !form.slug.trim()) {
      setError('Company name and slug are required.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const { data, error: insertError } = await supabase
        .from('clients')
        .insert({
          company_name: form.company_name.trim(),
          slug: form.slug.trim(),
          contractor_type: form.contractor_type || null,
          contact_email: form.contact_email || null,
          is_active: true,
        })
        .select('id')
        .single()

      if (insertError) throw insertError
      if (data) onCreated(data.id)
    } catch (err: any) {
      setError(err.message ?? 'Failed to create client.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-md p-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-semibold">New Client</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm text-muted-foreground mb-1">Company Name *</label>
            <input
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.company_name}
              onChange={e => set('company_name', e.target.value)}
              placeholder="Acme Roofing"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Slug (URL key) *</label>
            <input
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.slug}
              onChange={e => set('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="acme-roofing"
              required
            />
            <p className="text-xs text-muted-foreground mt-1">Used in /{'{slug}'}/hub</p>
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Contractor Type</label>
            <input
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.contractor_type}
              onChange={e => set('contractor_type', e.target.value)}
              placeholder="roofing, hvac, plumbing…"
            />
          </div>

          <div>
            <label className="block text-sm text-muted-foreground mb-1">Contact Email</label>
            <input
              type="email"
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.contact_email}
              onChange={e => set('contact_email', e.target.value)}
              placeholder="owner@company.com"
            />
          </div>

          {error && <p className="text-sm text-red-400">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-border rounded-lg text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="flex-1 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              {saving ? 'Creating…' : 'Create Client'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
