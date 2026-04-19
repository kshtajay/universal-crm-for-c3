import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'

interface Stats {
  tenants: number
  activeLeads: number
  totalRevenue: number
}

export function AdminDashboard() {
  const navigate = useNavigate()
  const [stats, setStats] = useState<Stats | null>(null)

  useEffect(() => {
    Promise.all([
      supabase.from('clients').select('id', { count: 'exact', head: true }),
      supabase.from('leads').select('id', { count: 'exact', head: true }).not('pipeline_stage', 'eq', 'lost'),
      supabase.from('invoices').select('amount').eq('status', 'paid'),
    ]).then(([clientsRes, leadsRes, invoicesRes]) => {
      const totalRevenue = (invoicesRes.data ?? []).reduce((sum, r) => sum + Number(r.amount), 0)
      setStats({
        tenants: clientsRes.count ?? 0,
        activeLeads: leadsRes.count ?? 0,
        totalRevenue,
      })
    })
  }, [])

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  const statCards = [
    {
      label: 'Total Tenants',
      value: stats ? stats.tenants.toString() : '—',
    },
    {
      label: 'Active Leads',
      value: stats ? stats.activeLeads.toString() : '—',
    },
    {
      label: 'Platform Revenue',
      value: stats ? `$${stats.totalRevenue.toLocaleString('en-US', { minimumFractionDigits: 2 })}` : '—',
    },
  ]

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 border-b border-border flex items-center px-6 gap-4">
        <span className="font-bold text-primary">K&A Admin Console</span>
        <nav className="ml-6 flex gap-4 text-sm text-muted-foreground">
          {[
            { label: 'Dashboard', path: '/admin' },
            { label: 'Clients', path: '/admin/clients' },
          ].map(({ label, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className="hover:text-foreground transition-colors"
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="ml-auto">
          <button
            onClick={handleSignOut}
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            Sign out
          </button>
        </div>
      </header>

      <main className="p-6 max-w-6xl mx-auto">
        <h1 className="text-2xl font-bold mb-6">Platform Overview</h1>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {statCards.map(stat => (
            <div key={stat.label} className="rounded-xl border border-border bg-card p-5">
              <p className="text-sm text-muted-foreground">{stat.label}</p>
              <p className="text-3xl font-bold mt-1">{stat.value}</p>
            </div>
          ))}
        </div>
      </main>
    </div>
  )
}
