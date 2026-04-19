import { useState, useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '../../integrations/supabase/client'
import { KanbanColumn } from './KanbanColumn'

interface Stage {
  stage_key: string
  stage_label: string
  color_code: string
  display_order: number
}

interface Lead {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  project_type: string | null
  preferred_date: string | null
  urgency: string | null
  pipeline_stage: string
  created_at: string
}

interface Props {
  clientId: string
  onLeadClick: (leadId: string) => void
}

export function KanbanBoard({ clientId, onLeadClick }: Props) {
  const [stages, setStages] = useState<Stage[]>([])
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const qc = useQueryClient()

  const loadData = useCallback(async () => {
    setLoading(true)

    // Get client's workflow template
    const { data: cw } = await supabase
      .from('client_workflows')
      .select('template_id')
      .eq('client_id', clientId)
      .single()

    if (cw?.template_id) {
      const { data: stageRows } = await supabase
        .from('workflow_stages')
        .select('stage_key, stage_label, color_code, display_order')
        .eq('template_id', cw.template_id)
        .order('display_order', { ascending: true })

      setStages(stageRows ?? [])
    } else {
      // Default stages if no workflow assigned
      setStages([
        { stage_key: 'new_lead', stage_label: 'New Lead', color_code: '#888', display_order: 0 },
        { stage_key: 'contacted', stage_label: 'Contacted', color_code: '#3B82F6', display_order: 1 },
        { stage_key: 'estimate_sent', stage_label: 'Estimate Sent', color_code: '#F59E0B', display_order: 2 },
        { stage_key: 'won', stage_label: 'Won', color_code: '#10B981', display_order: 3 },
        { stage_key: 'lost', stage_label: 'Lost', color_code: '#EF4444', display_order: 4 },
      ])
    }

    const { data: leadRows } = await supabase
      .from('leads')
      .select('id, full_name, phone, email, project_type, preferred_date, urgency, pipeline_stage, created_at')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false })
      .limit(200)

    setLeads(leadRows ?? [])
    setLoading(false)
  }, [clientId])

  useEffect(() => { loadData() }, [loadData])

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`leads-${clientId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'leads',
        filter: `client_id=eq.${clientId}`,
      }, () => { loadData() })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [clientId, loadData])

  const handleDrop = async (leadId: string, targetStage: string) => {
    const lead = leads.find(l => l.id === leadId)
    if (!lead || lead.pipeline_stage === targetStage) return

    // Optimistic update
    setLeads(prev =>
      prev.map(l => l.id === leadId ? { ...l, pipeline_stage: targetStage } : l)
    )

    await supabase
      .from('leads')
      .update({ pipeline_stage: targetStage, updated_at: new Date().toISOString() })
      .eq('id', leadId)

    // Fire stage_change automation
    supabase.functions.invoke('run-automation', {
      body: {
        event_type: 'stage_change',
        lead_id: leadId,
        client_id: clientId,
        payload: { new_stage: targetStage, previous_stage: lead.pipeline_stage },
      },
    }).catch(console.error)

    qc.invalidateQueries({ queryKey: ['lead', leadId] })
  }

  if (loading) {
    return (
      <div className="flex gap-4 p-6 overflow-x-auto">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="w-64 h-40 bg-card border border-border rounded-xl animate-pulse shrink-0" />
        ))}
      </div>
    )
  }

  const leadsByStage = (stageKey: string) => leads.filter(l => l.pipeline_stage === stageKey)

  return (
    <div className="flex gap-4 p-6 overflow-x-auto h-full">
      {stages.map(stage => (
        <KanbanColumn
          key={stage.stage_key}
          stage={stage}
          leads={leadsByStage(stage.stage_key)}
          onLeadClick={onLeadClick}
          onDrop={handleDrop}
        />
      ))}
      {stages.length === 0 && (
        <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          No workflow assigned to this client yet.
        </div>
      )}
    </div>
  )
}
