import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { AdminViewingBanner } from '@/components/AdminViewingBanner'
import { supabase } from '@/integrations/supabase/client'

interface ClientInfo {
  id: string
  company_name: string
  slug: string
  contractor_type: string | null
  contact_email: string | null
  is_active: boolean
}

export function AdminClientView() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const [client, setClient] = useState<ClientInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [leadCount, setLeadCount] = useState<number | null>(null)

  useEffect(() => {
    if (!slug) return
    supabase
      .from('clients')
      .select('id, company_name, slug, contractor_type, contact_email, is_active')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        setClient(data)
        if (data) {
          supabase
            .from('leads')
            .select('id', { count: 'exact', head: true })
            .eq('client_id', data.id)
            .then(({ count }) => setLeadCount(count ?? 0))
        }
        setLoading(false)
      })
  }, [slug])

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!client) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <p className="text-muted-foreground">Client "{slug}" not found.</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminViewingBanner tenantName={client.company_name} agentName="K&A Admin" />

      <div className="pt-12 p-6 max-w-4xl mx-auto">
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => navigate('/admin/clients')}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            ← Clients
          </button>
          <h1 className="text-2xl font-bold">{client.company_name}</h1>
          {!client.is_active && (
            <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-400">Inactive</span>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6">
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Total Leads</p>
            <p className="text-3xl font-bold mt-1">{leadCount ?? '—'}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Contractor Type</p>
            <p className="text-lg font-semibold mt-1 capitalize">{client.contractor_type ?? '—'}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <p className="text-sm text-muted-foreground">Hub URL</p>
            <p className="text-sm font-mono mt-1 text-primary">/{client.slug}/hub</p>
          </div>
        </div>

        <button
          onClick={() => navigate(`/${client.slug}/hub`)}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          Open Hub →
        </button>
      </div>
    </div>
  )
}
