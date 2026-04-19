import { useState, FormEvent } from 'react'
import { X, Sparkles, Loader2 } from 'lucide-react'
import { supabase } from '../../integrations/supabase/client'
import { AddressAutocomplete } from '../booking/AddressAutocomplete'

interface Props {
  clientId: string
  onClose: () => void
  onLeadCreated: (leadId: string) => void
}

interface ParsedFields {
  full_name?: string | null
  email?: string | null
  phone?: string | null
  property_address?: string | null
  service_type?: string | null
  project_type?: string | null
  preferred_date?: string | null
  urgency?: string | null
  notes?: string | null
  [key: string]: string | null | undefined
}

const LEAD_COLUMNS = new Set([
  'full_name', 'phone', 'email', 'property_address', 'project_type',
  'preferred_date', 'urgency', 'urgency_level', 'budget_range', 'preferred_time',
])

export function NewLeadIntakePanel({ clientId, onClose, onLeadCreated }: Props) {
  const [callNotes, setCallNotes] = useState('')
  const [parsing, setParsing] = useState(false)
  const [fields, setFields] = useState<ParsedFields>({})
  const [parsed, setParsed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleParse = async () => {
    if (!callNotes.trim()) return
    setParsing(true)
    setError(null)
    try {
      const { data, error: fnError } = await supabase.functions.invoke('parse-lead-text', {
        body: { text: callNotes, client_id: clientId },
      })
      if (fnError) throw fnError
      setFields(data.fields ?? {})
      setParsed(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Parse failed')
    } finally {
      setParsing(false)
    }
  }

  const handleFieldChange = (key: string, val: string) => {
    setFields(f => ({ ...f, [key]: val }))
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError(null)

    try {
      const leadData: Record<string, unknown> = {
        client_id: clientId,
        pipeline_stage: 'new_lead',
        lead_source: 'agent_intake',
      }
      const extras: Array<{ field_key: string; field_value: string }> = []

      for (const [key, value] of Object.entries(fields)) {
        if (!value) continue
        if (LEAD_COLUMNS.has(key)) {
          leadData[key] = value
        } else {
          extras.push({ field_key: key, field_value: String(value) })
        }
      }

      if (callNotes.trim()) {
        extras.push({ field_key: 'call_notes', field_value: callNotes })
      }

      const { data: lead, error: leadError } = await supabase
        .from('leads')
        .insert(leadData)
        .select('id')
        .single()

      if (leadError) throw leadError

      if (extras.length > 0) {
        await supabase.from('lead_intake_data').insert(
          extras.map(f => ({ lead_id: lead.id, client_id: clientId, ...f }))
        )
      }

      // Fire automation
      supabase.functions.invoke('run-automation', {
        body: { event_type: 'new_lead', lead_id: lead.id, client_id: clientId },
      }).catch(console.error)

      onLeadCreated(lead.id)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to save lead')
    } finally {
      setSaving(false)
    }
  }

  const DISPLAY_FIELDS: Array<{ key: string; label: string; type?: string }> = [
    { key: 'full_name', label: 'Full Name' },
    { key: 'phone', label: 'Phone', type: 'tel' },
    { key: 'email', label: 'Email', type: 'email' },
    { key: 'property_address', label: 'Address', type: 'address' },
    { key: 'project_type', label: 'Project Type' },
    { key: 'preferred_date', label: 'Preferred Date', type: 'date' },
    { key: 'urgency', label: 'Urgency' },
    { key: 'notes', label: 'Notes' },
  ]

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="relative ml-auto w-full max-w-lg h-full bg-card border-l border-border flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <div>
            <h2 className="font-semibold text-foreground">New Lead</h2>
            <p className="text-xs text-muted-foreground">Agent intake — parse call notes with AI</p>
          </div>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Call notes */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-foreground">Call Notes</label>
            <textarea
              rows={5}
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
              placeholder="Type or paste what the customer said — name, address, what they need, when, budget…"
              value={callNotes}
              onChange={e => setCallNotes(e.target.value)}
            />
            <button
              type="button"
              onClick={handleParse}
              disabled={parsing || !callNotes.trim()}
              className="flex items-center gap-2 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
            >
              {parsing ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              {parsing ? 'Parsing…' : 'Parse with AI'}
            </button>
          </div>

          {/* Parsed / manual fields */}
          <form id="intake-form" onSubmit={handleSubmit} className="space-y-3">
            {parsed && (
              <p className="text-xs text-primary font-medium">AI filled the fields below — review and correct as needed.</p>
            )}
            {DISPLAY_FIELDS.map(({ key, label, type = 'text' }) => (
              <div key={key} className="flex flex-col gap-1">
                <label className="text-xs font-medium text-muted-foreground">{label}</label>
                {type === 'address' ? (
                  <AddressAutocomplete
                    value={String(fields[key] ?? '')}
                    onChange={(addr, lat, lng) => {
                      handleFieldChange(key, addr)
                      if (lat !== undefined) handleFieldChange('property_lat', String(lat))
                      if (lng !== undefined) handleFieldChange('property_lng', String(lng))
                    }}
                  />
                ) : (
                  <input
                    type={type}
                    className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    value={String(fields[key] ?? '')}
                    onChange={e => handleFieldChange(key, e.target.value)}
                  />
                )}
              </div>
            ))}
          </form>

          {error && <p className="text-destructive text-sm">{error}</p>}
        </div>

        {/* Footer */}
        <div className="border-t border-border px-5 py-4">
          <button
            form="intake-form"
            type="submit"
            disabled={saving}
            className="w-full py-2.5 bg-primary text-primary-foreground rounded-xl font-semibold text-sm disabled:opacity-50 hover:opacity-90 transition-opacity"
          >
            {saving ? 'Saving…' : 'Create Lead'}
          </button>
        </div>
      </div>
    </div>
  )
}
