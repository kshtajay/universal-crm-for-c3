import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { ClipboardList, Users, DollarSign } from 'lucide-react'
import { AdminShell } from '@/components/admin/AdminShell'
import { CreateClientModal } from '@/components/admin/CreateClientModal'
import { supabase } from '@/integrations/supabase/client'

interface PackageRow {
  name: string
  price: number
  clientCount: number
}

interface Stats {
  activeClients: number
  activeUsers: number
  monthlyRevenue: number
}

export function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)
  const [packages, setPackages] = useState<PackageRow[]>([])
  const [showCreate, setShowCreate] = useState(false)

  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }).eq('is_active', true),
      supabase.from('client_user_assignments').select('id', { count: 'exact', head: true }),
      supabase.from('clients').select('packages(name, features_json)').eq('is_active', true),
      supabase.from('packages').select('name, features_json'),
    ]).then(([clientsRes, usersRes, clientPkgRes, pkgsRes]) => {
      const activeClients = clientsRes.count ?? 0
      const activeUsers = usersRes.count ?? 0

      // Calculate monthly revenue
      let monthlyRevenue = 0
      const clientPkgs = (clientPkgRes.data ?? []) as any[]
      for (const c of clientPkgs) {
        const price = c.packages?.features_json?.price_monthly ?? 0
        monthlyRevenue += Number(price)
      }

      setStats({ activeClients, activeUsers, monthlyRevenue })

      // Package distribution
      const pkgs = (pkgsRes.data ?? []) as any[]
      const pkgMap = new Map<string, number>()
      for (const c of clientPkgs) {
        const name = c.packages?.name
        if (name) pkgMap.set(name, (pkgMap.get(name) ?? 0) + 1)
      }

      setPackages(pkgs.map(p => ({
        name: p.name,
        price: p.features_json?.price_monthly ?? 0,
        clientCount: pkgMap.get(p.name) ?? 0,
      })))
    })
  }, [])

  return (
    <AdminShell>
      <div className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">Platform Dashboard</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate('/demo')}
              className="flex items-center gap-2 px-4 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
            >
              Open Demo
            </button>
            <button
              onClick={() => setShowCreate(true)}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity"
            >
              + Add Client
            </button>
          </div>
        </div>

        {/* Stat cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          {[
            {
              label: 'Active Clients',
              value: stats ? stats.activeClients.toString() : '—',
              icon: ClipboardList,
            },
            {
              label: 'Active Users',
              value: stats ? stats.activeUsers.toString() : '—',
              icon: Users,
            },
            {
              label: 'Monthly Revenue',
              value: stats ? `$${stats.monthlyRevenue.toLocaleString()}` : '—',
              icon: DollarSign,
            },
          ].map(({ label, value, icon: Icon }) => (
            <div key={label} className="bg-card border border-border rounded-xl p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm text-muted-foreground">{label}</p>
                <Icon className="w-5 h-5 text-muted-foreground" />
              </div>
              <p className="text-4xl font-bold mt-3">{value}</p>
            </div>
          ))}
        </div>

        {/* Package Distribution */}
        <div className="bg-card border border-border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Package Distribution</h2>
          <div className="space-y-3">
            {packages.length === 0 ? (
              <p className="text-muted-foreground text-sm">No packages seeded.</p>
            ) : (
              packages.map(pkg => (
                <div key={pkg.name} className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{pkg.name}</span>
                    <span className="text-sm text-muted-foreground">${pkg.price}/mo</span>
                  </div>
                  <span className="text-sm text-muted-foreground">
                    {pkg.clientCount} {pkg.clientCount === 1 ? 'client' : 'clients'}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {showCreate && (
        <CreateClientModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); window.location.reload() }}
        />
      )}
    </AdminShell>
  )
}
