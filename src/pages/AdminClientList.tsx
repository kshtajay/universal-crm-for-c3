import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheck, CircleX, SlidersHorizontal, MoreHorizontal } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { CreateClientModal } from '@/components/admin/CreateClientModal'
import { supabase } from '@/integrations/supabase/client'

interface ClientRow {
  id: string
  slug: string
  company_name: string
  is_active: boolean
  logoUrl: string | null
  packageName: string | null
  userCount: number
  consultationFee: number | null
  hasWorkflow: boolean
  hasBrand: boolean
  hasDepositRule: boolean
}

const AVATAR_COLORS = [
  '#E84545', '#E87D3E', '#D4A017', '#3EA855', '#3E8AE8',
  '#7B3EE8', '#E83EA8', '#3EC7E8',
]

function avatarColor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash)
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]
}

export function AdminClientList() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<ClientRow[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const loadClients = async () => {
    const { data } = await supabase
      .from('clients')
      .select(`
        id, slug, company_name, is_active,
        packages(name),
        brand_settings(logo_url),
        client_user_assignments(id),
        deposit_rules(consultation_fee),
        client_workflows(id)
      `)
      .order('created_at', { ascending: false })

    if (!data) { setLoading(false); return }

    setClients(data.map((c: any) => ({
      id: c.id,
      slug: c.slug,
      company_name: c.company_name,
      is_active: c.is_active,
      logoUrl: c.brand_settings?.logo_url ?? null,
      packageName: c.packages?.name ?? null,
      userCount: Array.isArray(c.client_user_assignments) ? c.client_user_assignments.length : 0,
      consultationFee: c.deposit_rules?.consultation_fee ?? null,
      hasBrand: !!c.brand_settings,
      hasWorkflow: !!c.client_workflows,
      hasDepositRule: !!c.deposit_rules && Number(c.deposit_rules.consultation_fee) > 0,
    })))
    setLoading(false)
  }

  useEffect(() => { loadClients() }, [])

  return (
    <AdminShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold">Clients</h1>
            <p className="text-muted-foreground text-sm mt-1">
              {clients.length} total · Manage branding, workflow, email, and users per client
            </p>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
          >
            + Add Client
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-2">
            {clients.map(client => {
              const configured = client.hasBrand && client.hasWorkflow && client.hasDepositRule
              const feeDisplay = client.consultationFee != null && Number(client.consultationFee) > 0
                ? `$${client.consultationFee}`
                : 'Not set'

              return (
                <div
                  key={client.id}
                  className="flex items-center gap-4 px-4 py-3.5 bg-card border border-border rounded-xl"
                >
                  {/* Avatar */}
                  {client.logoUrl ? (
                    <img
                      src={client.logoUrl}
                      alt={client.company_name}
                      className="w-10 h-10 rounded-full object-cover shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-white font-bold text-sm"
                      style={{ backgroundColor: avatarColor(client.company_name) }}
                    >
                      {client.company_name.charAt(0).toUpperCase()}
                    </div>
                  )}

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-foreground truncate">{client.company_name}</p>
                    <p className="text-sm text-muted-foreground font-mono">
                      /{client.slug}
                      {' · '}
                      {client.packageName ?? 'None'}
                      {' · '}
                      {client.userCount} {client.userCount === 1 ? 'user' : 'users'}
                      {' · '}
                      Fee: {feeDisplay}
                    </p>
                  </div>

                  {/* Badges + actions */}
                  <div className="flex items-center gap-2 shrink-0">
                    {/* Configured / Missing */}
                    {configured ? (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-green-500/50 text-green-400">
                        <CircleCheck className="w-3.5 h-3.5" />
                        Configured
                      </span>
                    ) : (
                      <span className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border border-red-500/50 text-red-400">
                        <CircleX className="w-3.5 h-3.5" />
                        Missing
                      </span>
                    )}

                    {/* Active pill */}
                    {client.is_active && (
                      <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                        Active
                      </span>
                    )}

                    {/* Control Center button */}
                    <button
                      onClick={() => navigate(`/admin/client/${client.slug}/dashboard`)}
                      className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-xs font-medium hover:bg-accent transition-colors"
                    >
                      <SlidersHorizontal className="w-3.5 h-3.5" />
                      Control Center
                    </button>

                    {/* 3-dot menu */}
                    <button className="p-1.5 rounded-lg hover:bg-accent transition-colors text-muted-foreground hover:text-foreground">
                      <MoreHorizontal className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {showCreate && (
        <CreateClientModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); loadClients() }}
        />
      )}
    </AdminShell>
  )
}
