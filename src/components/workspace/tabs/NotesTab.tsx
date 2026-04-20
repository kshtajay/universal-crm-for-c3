import { useState, useEffect } from 'react'
import { Plus, Phone, Bot } from 'lucide-react'
import { supabase } from '../../../integrations/supabase/client'

interface Note {
  id: string
  content: string
  note_type: string
  created_at: string
  created_by: string | null
}

interface ActivityRun {
  id: string
  trigger_type: string
  status: string
  created_at: string
  notes: string | null
}

interface Props {
  leadId: string
  clientId: string
}

export function NotesTab({ leadId, clientId }: Props) {
  const [notes, setNotes] = useState<Note[]>([])
  const [activity, setActivity] = useState<ActivityRun[]>([])
  const [loading, setLoading] = useState(true)
  const [newNote, setNewNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [tab, setTab] = useState<'notes' | 'activity'>('notes')

  useEffect(() => {
    Promise.all([
      supabase
        .from('lead_notes')
        .select('id, content, note_type, created_at, created_by')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false }),
      supabase
        .from('automation_runs')
        .select('id, trigger_type, status, created_at, notes')
        .eq('lead_id', leadId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]).then(([notesRes, actRes]) => {
      setNotes((notesRes.data ?? []) as Note[])
      setActivity((actRes.data ?? []) as ActivityRun[])
      setLoading(false)
    })
  }, [leadId])

  const addNote = async () => {
    if (!newNote.trim()) return
    setSaving(true)
    const { data } = await supabase
      .from('lead_notes')
      .insert({ lead_id: leadId, client_id: clientId, content: newNote.trim(), note_type: 'call' })
      .select('id, content, note_type, created_at, created_by')
      .single()
    if (data) setNotes(prev => [data as Note, ...prev])
    setNewNote('')
    setSaving(false)
  }

  if (loading) return (
    <div className="p-5 space-y-3 animate-pulse">
      {[...Array(4)].map((_, i) => <div key={i} className="h-12 bg-secondary rounded-lg" />)}
    </div>
  )

  return (
    <div className="p-5 space-y-4">
      {/* Tab toggle */}
      <div className="flex gap-1 bg-secondary rounded-lg p-1 w-fit">
        {(['notes', 'activity'] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors capitalize ${
              tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'notes' ? 'Call Notes' : 'Activity Log'}
          </button>
        ))}
      </div>

      {tab === 'notes' && (
        <>
          {/* Add note */}
          <div className="bg-secondary rounded-xl p-4 space-y-3">
            <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
              <Phone className="w-3.5 h-3.5" />
              Add Call Note
            </div>
            <textarea
              className="w-full bg-card border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[80px] resize-none"
              placeholder="What happened on this call?"
              value={newNote}
              onChange={e => setNewNote(e.target.value)}
            />
            <div className="flex justify-end">
              <button
                onClick={addNote}
                disabled={saving || !newNote.trim()}
                className="flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
                {saving ? 'Saving…' : 'Add Note'}
              </button>
            </div>
          </div>

          {/* Notes list */}
          {notes.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No notes yet</p>
          ) : (
            <div className="space-y-2">
              {notes.map(n => (
                <div key={n.id} className="px-3 py-3 bg-secondary rounded-lg">
                  <div className="flex items-center gap-2 mb-1">
                    <Phone className="w-3 h-3 text-muted-foreground" />
                    <span className="text-xs text-muted-foreground capitalize">{n.note_type}</span>
                    <span className="text-xs text-muted-foreground ml-auto">
                      {new Date(n.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                    </span>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{n.content}</p>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {tab === 'activity' && (
        <div className="space-y-2">
          {activity.length === 0 ? (
            <p className="text-muted-foreground text-sm text-center py-8">No automation activity yet</p>
          ) : (
            activity.map(run => (
              <div key={run.id} className="flex items-start gap-3 px-3 py-3 bg-secondary rounded-lg">
                <Bot className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-sm font-medium capitalize">{run.trigger_type.replace(/_/g, ' ')}</span>
                    <span className={`px-1.5 py-0.5 rounded text-[10px] font-bold ${
                      run.status === 'success' ? 'bg-green-500/20 text-green-400'
                      : run.status === 'failed' ? 'bg-red-500/20 text-red-400'
                      : 'bg-secondary text-muted-foreground'
                    }`}>
                      {run.status}
                    </span>
                  </div>
                  {run.notes && <p className="text-xs text-muted-foreground">{run.notes}</p>}
                </div>
                <span className="text-xs text-muted-foreground shrink-0">
                  {new Date(run.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </span>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}
