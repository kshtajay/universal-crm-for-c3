import { ReactNode } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Building2, GitBranch, Zap, BarChart2,
  Package, Users, HelpCircle, Settings, PanelLeft,
} from 'lucide-react'

const NAV_ITEMS = [
  { label: 'Dashboard',         icon: LayoutDashboard, path: '/admin' },
  { label: 'Clients',           icon: Building2,       path: '/admin/clients' },
  { label: 'Workflows',         icon: GitBranch,       path: '/admin/workflows' },
  { label: 'Automations',       icon: Zap,             path: '/admin/automations' },
  { label: 'Performance',       icon: BarChart2,       path: '/admin/performance' },
  { label: 'Packages',          icon: Package,         path: '/admin/packages' },
  { label: 'Users',             icon: Users,           path: '/admin/users' },
  { label: 'Support',           icon: HelpCircle,      path: '/admin/support' },
  { label: 'Platform Settings', icon: Settings,        path: '/admin/platform-settings' },
]

interface Props {
  children: ReactNode
}

export function AdminShell({ children }: Props) {
  const navigate = useNavigate()
  const { pathname } = useLocation()

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-60 bg-card flex flex-col shrink-0 border-r border-border">
        <div className="px-5 py-5 border-b border-border">
          <span className="text-xs font-bold tracking-widest text-muted-foreground">ADMIN CONSOLE</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => {
            const active =
              path === '/admin'
                ? pathname === '/admin'
                : pathname === path || pathname.startsWith(path + '/')
            return (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                  active
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
              </button>
            )
          })}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0">
        <div className="h-12 border-b border-border flex items-center px-4 gap-3 shrink-0 bg-card">
          <PanelLeft className="w-5 h-5 text-muted-foreground" />
          <span className="text-sm text-muted-foreground">Kennedy & Associates — Platform Management</span>
        </div>
        <div className="flex-1 overflow-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
