import { useNavigate } from 'react-router-dom'
import { supabase } from '@/integrations/supabase/client'

export function AdminDashboard() {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/login')
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="h-14 border-b border-border flex items-center px-6 gap-4">
        <span className="font-bold text-gold-DEFAULT">K&A Admin Console</span>
        <nav className="ml-6 flex gap-4 text-sm text-muted-foreground">
          {['Dashboard', 'Clients', 'Workflows', 'Automations', 'Email Templates', 'Users', 'Reports'].map(item => (
            <button
              key={item}
              onClick={() => item === 'Clients' ? navigate('/admin/clients') : undefined}
              className="hover:text-foreground transition-colors"
            >
              {item}
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
          {[
            { label: 'Total Tenants', value: '—' },
            { label: 'Active Leads', value: '—' },
            { label: 'Platform Revenue', value: '—' },
          ].map(stat => (
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
