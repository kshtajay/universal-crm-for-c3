import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Bell, BellOff, Briefcase, CheckSquare, DollarSign, Calendar } from 'lucide-react'
import { useClientContext } from '../hooks/useClientContext'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { supabase } from '../integrations/supabase/client'

interface Stats {
  activeJobs: number
  openTasks: number
  unpaidInvoiceAmount: number
  todayAppointments: number
}

interface Appointment {
  id: string
  full_name: string | null
  preferred_date: string | null
  pipeline_stage: string | null
}

export function TenantDashboard() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { clientId, loading: ctxLoading } = useClientContext(slug)
  const [userId, setUserId] = useState<string | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const { permission, subscribed, loading: pushLoading, subscribe, unsubscribe } =
    usePushNotifications(clientId, userId)

  useEffect(() => {
    if (!clientId) return

    const today = new Date().toISOString().slice(0, 10)
    const terminalStages = ['complete', 'lost', 'won']

    Promise.all([
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .not('pipeline_stage', 'in', `(${terminalStages.join(',')})`),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('status', 'open'),
      supabase
        .from('invoices')
        .select('amount')
        .eq('client_id', clientId)
        .eq('status', 'pending'),
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .eq('preferred_date', today),
      supabase
        .from('leads')
        .select('id, full_name, preferred_date, pipeline_stage')
        .eq('client_id', clientId)
        .gte('preferred_date', today)
        .order('preferred_date', { ascending: true })
        .limit(5),
    ]).then(([activeRes, tasksRes, invoicesRes, todayRes, apptRes]) => {
      const unpaid = (invoicesRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
      setStats({
        activeJobs: activeRes.count ?? 0,
        openTasks: tasksRes.count ?? 0,
        unpaidInvoiceAmount: unpaid,
        todayAppointments: todayRes.count ?? 0,
      })
      setAppointments(apptRes.data ?? [])
    })
  }, [clientId])

  const statCards = stats
    ? [
        { label: 'Active Jobs', value: stats.activeJobs.toString(), icon: Briefcase, color: 'text-blue-400' },
        { label: 'Open Tasks', value: stats.openTasks.toString(), icon: CheckSquare, color: 'text-amber-400' },
        { label: 'Unpaid Invoices', value: `$${stats.unpaidInvoiceAmount.toLocaleString('en-US', { minimumFractionDigits: 0 })}`, icon: DollarSign, color: 'text-green-400' },
        { label: "Today's Appts", value: stats.todayAppointments.toString(), icon: Calendar, color: 'text-purple-400' },
      ]
    : null

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-52 border-r border-border p-3 hidden md:flex flex-col shrink-0">
        <div className="mb-6 px-2 pt-2">
          <p className="font-bold text-primary text-sm">{slug}</p>
        </div>
        <nav className="space-y-0.5 text-sm">
          {[
            { label: 'Dashboard', path: `/${slug}/dashboard`, active: true },
            { label: 'Hub', path: `/${slug}/hub`, active: false },
            { label: 'Settings', path: `/${slug}/settings`, active: false },
          ].map(({ label, path, active }) => (
            <div
              key={label}
              onClick={() => navigate(path)}
              className={`px-3 py-2 rounded-lg cursor-pointer text-sm transition-colors ${
                active
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-muted-foreground hover:bg-accent hover:text-foreground'
              }`}
            >
              {label}
            </div>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-auto p-6">
        {/* Header row */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">Dashboard</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Push notification toggle */}
          {permission !== 'unsupported' && permission !== 'denied' && (
            <button
              onClick={subscribed ? unsubscribe : subscribe}
              disabled={pushLoading}
              title={subscribed ? 'Disable push notifications' : 'Enable push notifications'}
              className="flex items-center gap-2 px-3 py-2 rounded-lg border border-border text-sm hover:bg-accent transition-colors disabled:opacity-40"
            >
              {subscribed
                ? <><Bell className="w-4 h-4 text-primary" /> Notifications on</>
                : <><BellOff className="w-4 h-4 text-muted-foreground" /> Enable notifications</>
              }
            </button>
          )}
        </div>

        {ctxLoading || !stats ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              {statCards!.map(({ label, value, icon: Icon, color }) => (
                <div key={label} className="rounded-xl border border-border bg-card p-5">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={`w-4 h-4 ${color}`} />
                    <p className="text-xs text-muted-foreground font-medium">{label}</p>
                  </div>
                  <p className="text-3xl font-bold">{value}</p>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Upcoming appointments */}
              <div className="lg:col-span-2 rounded-xl border border-border bg-card p-5">
                <h2 className="font-semibold mb-4">Upcoming Appointments</h2>
                {appointments.length === 0 ? (
                  <p className="text-muted-foreground text-sm text-center py-8">
                    No upcoming appointments.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {appointments.map(appt => (
                      <div
                        key={appt.id}
                        onClick={() => navigate(`/${slug}/hub?lead=${appt.id}`)}
                        className="flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-accent transition-colors cursor-pointer"
                      >
                        <div>
                          <p className="font-medium text-sm">{appt.full_name ?? 'Unnamed'}</p>
                          <p className="text-xs text-muted-foreground capitalize">
                            {appt.pipeline_stage?.replace(/_/g, ' ')}
                          </p>
                        </div>
                        {appt.preferred_date && (
                          <span className="text-xs text-muted-foreground">
                            {new Date(appt.preferred_date + 'T00:00:00').toLocaleDateString('en-US', {
                              month: 'short',
                              day: 'numeric',
                            })}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* What matters right now */}
              <div className="rounded-xl border border-border bg-card p-5">
                <h2 className="font-semibold mb-4">What matters right now</h2>
                <div className="space-y-3 text-sm">
                  {stats.openTasks > 0 && (
                    <div
                      onClick={() => navigate(`/${slug}/hub`)}
                      className="flex items-start gap-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20 cursor-pointer hover:bg-amber-500/20 transition-colors"
                    >
                      <CheckSquare className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
                      <span className="text-amber-300">
                        {stats.openTasks} open task{stats.openTasks !== 1 ? 's' : ''} need attention
                      </span>
                    </div>
                  )}
                  {stats.unpaidInvoiceAmount > 0 && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                      <DollarSign className="w-4 h-4 text-green-400 shrink-0 mt-0.5" />
                      <span className="text-green-300">
                        ${stats.unpaidInvoiceAmount.toLocaleString()} in pending payments
                      </span>
                    </div>
                  )}
                  {stats.todayAppointments > 0 && (
                    <div className="flex items-start gap-2 p-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
                      <Calendar className="w-4 h-4 text-purple-400 shrink-0 mt-0.5" />
                      <span className="text-purple-300">
                        {stats.todayAppointments} appointment{stats.todayAppointments !== 1 ? 's' : ''} today
                      </span>
                    </div>
                  )}
                  {stats.openTasks === 0 && stats.unpaidInvoiceAmount === 0 && stats.todayAppointments === 0 && (
                    <p className="text-muted-foreground text-sm text-center py-4">All clear — you're on top of it.</p>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
