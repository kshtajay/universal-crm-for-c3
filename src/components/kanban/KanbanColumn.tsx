import { useState } from 'react'
import { LeadCard } from './LeadCard'

interface Lead {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  project_type: string | null
  preferred_date: string | null
  urgency: string | null
  created_at: string
}

interface Stage {
  stage_key: string
  stage_label: string
  color_code: string
}

interface Props {
  stage: Stage
  leads: Lead[]
  onLeadClick: (leadId: string) => void
  onDrop: (leadId: string, targetStage: string) => void
}

export function KanbanColumn({ stage, leads, onLeadClick, onDrop }: Props) {
  const [dragOver, setDragOver] = useState(false)

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(true)
  }

  const handleDragLeave = () => setDragOver(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    const leadId = e.dataTransfer.getData('leadId')
    if (leadId) onDrop(leadId, stage.stage_key)
  }

  return (
    <div
      className={`flex flex-col w-64 shrink-0 rounded-xl border transition-colors ${
        dragOver ? 'border-primary bg-primary/5' : 'border-border bg-background'
      }`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Column header */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-border">
        <div className="flex items-center gap-2">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: stage.color_code ?? '#888' }}
          />
          <span className="text-sm font-semibold text-foreground">{stage.stage_label}</span>
        </div>
        <span className="text-xs text-muted-foreground bg-secondary px-1.5 py-0.5 rounded-full">
          {leads.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex-1 p-2 space-y-2 min-h-[120px] overflow-y-auto">
        {leads.map(lead => (
          <LeadCard
            key={lead.id}
            lead={lead}
            onClick={() => onLeadClick(lead.id)}
            onDragStart={e => {
              e.dataTransfer.setData('leadId', lead.id)
              e.dataTransfer.effectAllowed = 'move'
            }}
          />
        ))}
        {leads.length === 0 && (
          <div className="h-16 rounded-lg border-2 border-dashed border-border/50 flex items-center justify-center">
            <span className="text-xs text-muted-foreground">Drop here</span>
          </div>
        )}
      </div>
    </div>
  )
}
