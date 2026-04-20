import { useState, useEffect } from 'react'
import { Plus, CloudSun, Users } from 'lucide-react'
import { supabase } from '../../../integrations/supabase/client'

interface DailyLog {
  id: string
  log_date: string
  crew_count: number
  hours_worked: number
  summary: string
  weather_description: string | null
  weather_auto_filled: boolean
}

interface Props {
  leadId: string
  clientId: string
}

const EMPTY_LOG = { log_date: new Date().toISOString().slice(0, 10), crew_count: 1, hours_worked: 8, summary: '' }

export function DailyLogsTab({ leadId, clientId }: Props) {
  const [logs, setLogs] = useState<DailyLog[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_LOG)

  useEffect(() => {
    supabase
      .from('daily_logs')
      .select('id, log_date, crew_count, hours_worked, summary, weather_description, weather_auto_filled')
      .eq('lead_id', leadId)
      .order('log_date', { ascending: false })
      .then(({ data }) => {
        setLogs((data ?? []) as DailyLog[])
        setLoading(false)
      })
  }, [leadId])

  const addLog = async () => {
    if (!form.summary.trim()) return
    setSaving(true)

    // Fetch lead for lat/lng to auto-fill weather
    const { data: lead } = await supabase
      .from('leads')
      .select('property_lat, property_lng')
      .eq('id', leadId)
      .single()

    let weatherDesc: string | null = null
    let weatherAutoFilled = false

    if (lead?.property_lat && lead?.property_lng) {
      const { data: wx } = await supabase.functions.invoke('fetch-weather', {
        body: { lat: lead.property_lat, lng: lead.property_lng, target_date: form.log_date, type: 'forecast' },
      })
      if (wx?.description) {
        weatherDesc = wx.description
        weatherAutoFilled = true
      }
    }

    const { data } = await supabase
      .from('daily_logs')
      .insert({
        lead_id: leadId,
        client_id: clientId,
        log_date: form.log_date,
        crew_count: form.crew_count,
        hours_worked: form.hours_worked,
        summary: form.summary,
        weather_description: weatherDesc,
        weather_auto_filled: weatherAutoFilled,
      })
      .select('id, log_date, crew_count, hours_worked, summary, weather_description, weather_auto_filled')
      .single()

    if (data) setLogs(prev => [data as DailyLog, ...prev])
    setForm(EMPTY_LOG)
    setShowForm(false)
    setSaving(false)
  }

  if (loading) return (
    <div className="p-5 space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => <div key={i} className="h-16 bg-secondary rounded-lg" />)}
    </div>
  )

  return (
    <div className="p-5 space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide">Daily Logs</p>
        <button
          onClick={() => setShowForm(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90"
        >
          <Plus className="w-3.5 h-3.5" />
          Log Day
        </button>
      </div>

      {/* Add form */}
      {showForm && (
        <div className="bg-secondary rounded-xl p-4 space-y-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">New Daily Log</p>
          <div className="grid grid-cols-3 gap-2">
            <input
              type="date"
              className="col-span-3 bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              value={form.log_date}
              onChange={e => setForm(p => ({ ...p, log_date: e.target.value }))}
            />
            <input
              type="number"
              className="bg-card border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Crew #"
              min={1}
              value={form.crew_count}
              onChange={e => setForm(p => ({ ...p, crew_count: Number(e.target.value) }))}
            />
            <input
              type="number"
              className="col-span-2 bg-card border border-border rounded-lg px-2 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
              placeholder="Hours worked"
              min={0}
              step={0.5}
              value={form.hours_worked}
              onChange={e => setForm(p => ({ ...p, hours_worked: Number(e.target.value) }))}
            />
          </div>
          <textarea
            className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px] resize-none"
            placeholder="What was completed today?"
            value={form.summary}
            onChange={e => setForm(p => ({ ...p, summary: e.target.value }))}
          />
          <p className="text-[10px] text-muted-foreground">Weather will be auto-filled from the job address if available.</p>
          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent">
              Cancel
            </button>
            <button
              onClick={addLog}
              disabled={saving || !form.summary.trim()}
              className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save Log'}
            </button>
          </div>
        </div>
      )}

      {/* Log list */}
      {logs.length === 0 ? (
        <p className="text-muted-foreground text-sm text-center py-8">No daily logs yet</p>
      ) : (
        <div className="space-y-3">
          {logs.map(log => (
            <div key={log.id} className="bg-secondary rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold">
                  {new Date(log.log_date + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}
                </span>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Users className="w-3 h-3" />{log.crew_count}</span>
                  <span>{log.hours_worked}h</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">{log.summary}</p>
              {log.weather_description && (
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                  <CloudSun className="w-3.5 h-3.5" />
                  <span>{log.weather_description}</span>
                  {log.weather_auto_filled && <span className="text-primary">(auto)</span>}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
