import { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { CheckCircle, Clock, ExternalLink, FileText } from 'lucide-react'
import { supabase } from '../integrations/supabase/client'

interface Brand {
  brand_name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
}

interface Lead {
  id: string
  full_name: string
  pipeline_stage: string | null
  project_type: string | null
  preferred_date: string | null
  property_address: string | null
}

interface Estimate {
  id: string
  status: string
  total_contractor_amount: number
  created_at: string
}

interface Invoice {
  id: string
  amount: number
  type: string
  status: string
  stripe_payment_url: string | null
  paid_at: string | null
  created_at: string
}

interface Task {
  id: string
  title: string
  status: string
  due_at: string | null
}

interface PortalData {
  lead: Lead
  brand: Brand
  estimate: Estimate | null
  invoices: Invoice[]
  tasks: Task[]
}

const STAGE_LABELS: Record<string, string> = {
  new_lead: 'Received',
  contacted: 'In Review',
  site_visit_scheduled: 'Site Visit Scheduled',
  estimate_sent: 'Estimate Sent',
  follow_up: 'Follow-up',
  won: 'Project Approved',
  in_progress: 'In Progress',
  completed: 'Completed',
  lost: 'Closed',
}

export function CustomerPortal() {
  const { token } = useParams<{ token: string }>()
  const [data, setData] = useState<PortalData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!token) { setError('Invalid link.'); setLoading(false); return }
    supabase.functions.invoke('get-portal-data', { body: { token } })
      .then(({ data: res, error: err }) => {
        if (err || res?.error) { setError('Project not found.'); return }
        setData(res as PortalData)
      })
      .finally(() => setLoading(false))
  }, [token])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-muted-foreground">{error ?? 'Something went wrong.'}</p>
        </div>
      </div>
    )
  }

  const { lead, brand, estimate, invoices, tasks } = data
  const unpaidInvoices = invoices.filter(i => i.status !== 'paid')
  const paidInvoices = invoices.filter(i => i.status === 'paid')
  const stageLabel = STAGE_LABELS[lead.pipeline_stage ?? ''] ?? lead.pipeline_stage ?? 'In Review'

  return (
    <div
      className="min-h-screen"
      style={{ backgroundColor: brand.secondary_color, color: '#f0f0f0' }}
    >
      {/* Header */}
      <header
        className="px-6 py-4 flex items-center gap-3"
        style={{ borderBottom: '1px solid rgba(255,255,255,0.1)' }}
      >
        {brand.logo_url ? (
          <img src={brand.logo_url} alt={brand.brand_name} className="h-8 object-contain" />
        ) : (
          <span className="font-bold text-lg" style={{ color: brand.primary_color }}>
            {brand.brand_name}
          </span>
        )}
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8 space-y-6">
        {/* Project status */}
        <div
          className="rounded-xl p-5"
          style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
        >
          <p className="text-sm opacity-60 mb-1">Project for</p>
          <h1 className="text-2xl font-bold mb-1">{lead.full_name}</h1>
          {lead.property_address && (
            <p className="text-sm opacity-60 mb-3">{lead.property_address}</p>
          )}
          <div className="flex items-center gap-2">
            <span
              className="px-3 py-1 rounded-full text-sm font-semibold"
              style={{ backgroundColor: brand.primary_color, color: brand.secondary_color }}
            >
              {stageLabel}
            </span>
            {lead.project_type && (
              <span className="text-sm opacity-60">{lead.project_type}</span>
            )}
          </div>
        </div>

        {/* Estimate */}
        {estimate && (
          <div
            className="rounded-xl p-5"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            <div className="flex items-center gap-2 mb-3">
              <FileText className="w-4 h-4 opacity-60" />
              <p className="text-sm font-semibold uppercase tracking-wide opacity-60">Estimate</p>
            </div>
            <div className="flex items-end justify-between">
              <span className="text-3xl font-bold" style={{ color: brand.primary_color }}>
                ${Number(estimate.total_contractor_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
              </span>
              <span
                className="px-2 py-0.5 rounded text-xs font-medium capitalize"
                style={{
                  backgroundColor: estimate.status === 'approved' ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.1)',
                  color: estimate.status === 'approved' ? '#4ade80' : '#ccc',
                }}
              >
                {estimate.status}
              </span>
            </div>
          </div>
        )}

        {/* Unpaid invoices */}
        {unpaidInvoices.length > 0 && (
          <div
            className="rounded-xl p-5 space-y-3"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            <p className="text-sm font-semibold uppercase tracking-wide opacity-60">Action Required</p>
            {unpaidInvoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between">
                <div>
                  <p className="font-medium capitalize">{inv.type} Payment</p>
                  <p className="text-sm opacity-60">${Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}</p>
                </div>
                {inv.stripe_payment_url ? (
                  <a
                    href={inv.stripe_payment_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-semibold transition-opacity hover:opacity-80"
                    style={{ backgroundColor: brand.primary_color, color: brand.secondary_color }}
                  >
                    Pay Now <ExternalLink className="w-3 h-3" />
                  </a>
                ) : (
                  <span className="text-sm opacity-40">Pending</span>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Paid invoices */}
        {paidInvoices.length > 0 && (
          <div
            className="rounded-xl p-5 space-y-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            <p className="text-sm font-semibold uppercase tracking-wide opacity-60">Payments Received</p>
            {paidInvoices.map(inv => (
              <div key={inv.id} className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-green-400" />
                  <span className="text-sm capitalize">{inv.type} Payment</span>
                </div>
                <span className="text-sm opacity-60">
                  ${Number(inv.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* Next steps (open tasks) */}
        {tasks.length > 0 && (
          <div
            className="rounded-xl p-5 space-y-2"
            style={{ backgroundColor: 'rgba(255,255,255,0.06)' }}
          >
            <p className="text-sm font-semibold uppercase tracking-wide opacity-60">Next Steps</p>
            {tasks.map(task => (
              <div key={task.id} className="flex items-center gap-2">
                <Clock className="w-4 h-4 opacity-40 shrink-0" />
                <span className="text-sm">{task.title}</span>
                {task.due_at && (
                  <span className="text-xs opacity-40 ml-auto shrink-0">
                    {new Date(task.due_at).toLocaleDateString()}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}

        <p className="text-center text-xs opacity-30 pb-4">
          Powered by {brand.brand_name}
        </p>
      </main>
    </div>
  )
}
