import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { Plus, ExternalLink } from 'lucide-react'
import { supabase } from '@/integrations/supabase/client'
import { CreateClientModal } from '@/components/admin/CreateClientModal'

interface Client {
  id: string
  company_name: string
  slug: string
  contractor_type: string | null
  contact_email: string | null
  is_active: boolean
  created_at: string
}

export function AdminClientList() {
  const navigate = useNavigate()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)

  const loadClients = () => {
    supabase
      .from('clients')
      .select('id, company_name, slug, contractor_type, contact_email, is_active, created_at')
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setClients(data ?? [])
        setLoading(false)
      })
  }

  useEffect(() => { loadClients() }, [])

  const handleCreated = (_id: string) => {
    setShowCreate(false)
    loadClients()
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 border-b border-border flex items-center px-6 gap-4">
        <button
          onClick={() => navigate('/admin')}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Admin
        </button>
        <h1 className="text-xl font-bold">Clients</h1>
        <button
          onClick={() => setShowCreate(true)}
          className="ml-auto flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
        >
          <Plus className="w-4 h-4" />
          New Client
        </button>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : clients.length === 0 ? (
          <div className="text-center py-20 text-muted-foreground text-sm">
            No clients yet. Create one to get started.
          </div>
        ) : (
          <div className="space-y-2">
            {clients.map(client => (
              <div
                key={client.id}
                className="flex items-center gap-4 p-4 rounded-xl border border-border bg-card hover:bg-accent/40 transition-colors"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-semibold truncate">{client.company_name}</p>
                    {!client.is_active && (
                      <span className="text-xs px-1.5 py-0.5 rounded bg-red-500/20 text-red-400">Inactive</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-muted-foreground">
                    <span className="font-mono">/{client.slug}</span>
                    {client.contractor_type && <span>{client.contractor_type}</span>}
                    {client.contact_email && <span>{client.contact_email}</span>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => navigate(`/admin/client/${client.slug}/dashboard`)}
                    className="flex items-center gap-1 px-3 py-1.5 border border-border rounded-lg text-xs hover:bg-accent transition-colors"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showCreate && (
        <CreateClientModal
          onClose={() => setShowCreate(false)}
          onCreated={handleCreated}
        />
      )}
    </div>
  )
}
