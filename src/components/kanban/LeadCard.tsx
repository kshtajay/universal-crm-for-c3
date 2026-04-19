import { Phone, Calendar, AlertTriangle } from 'lucide-react'

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

interface Props {
  lead: Lead
  onClick: () => void
  onDragStart: (e: React.DragEvent) => void
}

export function LeadCard({ lead, onClick, onDragStart }: Props) {
  const isUrgent = lead.urgency === 'High' || lead.urgency === 'emergency'
  const initials = (lead.full_name ?? '?')
    .split(' ')
    .map(w => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase()

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className="bg-card border border-border rounded-xl p-3 cursor-pointer hover:border-primary/50 hover:shadow-md transition-all select-none group"
    >
      <div className="flex items-start gap-2.5">
        {/* Avatar */}
        <div className="w-8 h-8 rounded-full bg-primary/20 text-primary flex items-center justify-center text-xs font-bold shrink-0">
          {initials}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p className="font-medium text-sm text-foreground truncate">{lead.full_name ?? 'Unknown'}</p>
            {isUrgent && <AlertTriangle className="w-3.5 h-3.5 text-destructive shrink-0" />}
          </div>

          {lead.project_type && (
            <p className="text-xs text-muted-foreground truncate mt-0.5">{lead.project_type}</p>
          )}

          <div className="flex items-center gap-3 mt-1.5">
            {lead.phone && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Phone className="w-3 h-3" />
                <span className="truncate">{lead.phone}</span>
              </span>
            )}
            {lead.preferred_date && (
              <span className="flex items-center gap-1 text-xs text-muted-foreground">
                <Calendar className="w-3 h-3" />
                {lead.preferred_date}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
