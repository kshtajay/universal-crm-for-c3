import { useEffect, useState } from 'react'
import { Phone, Mail, MapPin, Calendar, Tag, AlertTriangle } from 'lucide-react'
import { supabase } from '../../../integrations/supabase/client'

interface Lead {
  id: string
  full_name: string | null
  phone: string | null
  email: string | null
  property_address: string | null
  project_type: string | null
  budget_range: string | null
  preferred_date: string | null
  preferred_time: string | null
  urgency: string | null
  pipeline_stage: string
  lead_source: string | null
  contractor_type: string | null
  created_at: string
}

interface Props { leadId: string }

export function OverviewTab({ leadId }: Props) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('leads')
      .select('id, full_name, phone, email, property_address, project_type, budget_range, preferred_date, preferred_time, urgency, pipeline_stage, lead_source, contractor_type, created_at')
      .eq('id', leadId)
      .single()
      .then(({ data }) => { setLead(data); setLoading(false) })
  }, [leadId])

  if (loading) return <LoadingSkeleton />

  if (!lead) return <p className="text-muted-foreground text-sm p-4">Lead not found.</p>

  const row = (Icon: React.ElementType, label: string, value: string | null) =>
    value ? (
      <div className="flex items-start gap-3 py-2.5 border-b border-border last:border-0">
        <Icon className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <div>
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="text-sm text-foreground">{value}</p>
        </div>
      </div>
    ) : null

  const urgencyColor = lead.urgency === 'High' ? 'text-destructive' : lead.urgency === 'Medium' ? 'text-amber-400' : 'text-muted-foreground'

  return (
    <div className="p-5 space-y-5">
      {/* Lead header */}
      <div className="flex items-start gap-3">
        <div className="w-12 h-12 rounded-full bg-primary/20 text-primary flex items-center justify-center font-bold text-lg shrink-0">
          {(lead.full_name ?? '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div>
          <h2 className="font-semibold text-lg text-foreground">{lead.full_name ?? 'Unknown'}</h2>
          <div className="flex items-center gap-2 flex-wrap mt-0.5">
            <span className="text-xs bg-secondary text-muted-foreground px-2 py-0.5 rounded-full capitalize">
              {lead.pipeline_stage.replace(/_/g, ' ')}
            </span>
            {lead.urgency && (
              <span className={`flex items-center gap-1 text-xs ${urgencyColor}`}>
                <AlertTriangle className="w-3 h-3" />
                {lead.urgency} Priority
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Contact info */}
      <div className="bg-secondary rounded-xl px-4 py-1">
        {row(Phone, 'Phone', lead.phone)}
        {row(Mail, 'Email', lead.email)}
        {row(MapPin, 'Address', lead.property_address)}
      </div>

      {/* Job info */}
      <div className="bg-secondary rounded-xl px-4 py-1">
        {row(Tag, 'Project Type', lead.project_type)}
        {row(Tag, 'Budget', lead.budget_range)}
        {row(Calendar, 'Preferred Date', lead.preferred_date
          ? `${lead.preferred_date}${lead.preferred_time ? ' — ' + lead.preferred_time : ''}`
          : null
        )}
        {row(Tag, 'Lead Source', lead.lead_source)}
        {row(Tag, 'Contractor Type', lead.contractor_type)}
      </div>

      <p className="text-xs text-muted-foreground">
        Created {new Date(lead.created_at).toLocaleDateString('en-US', { dateStyle: 'medium' })}
      </p>
    </div>
  )
}

function LoadingSkeleton() {
  return (
    <div className="p-5 space-y-4 animate-pulse">
      <div className="flex gap-3">
        <div className="w-12 h-12 rounded-full bg-secondary" />
        <div className="space-y-2">
          <div className="h-5 w-40 bg-secondary rounded" />
          <div className="h-3 w-24 bg-secondary rounded" />
        </div>
      </div>
      {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-secondary rounded-xl" />)}
    </div>
  )
}
