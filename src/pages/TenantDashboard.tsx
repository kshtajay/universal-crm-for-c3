import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Bell, Lightbulb, Clock, BarChart2, Users } from 'lucide-react'
import { useClientContext } from '../hooks/useClientContext'
import { usePushNotifications } from '../hooks/usePushNotifications'
import { supabase } from '../integrations/supabase/client'

interface BrandInfo {
  logo_url: string | null
  tagline: string | null
}

interface Stats {
  revenue: number
  openLeads: number
  jobsScheduled: number
  unpaidAmount: number
}

interface Appointment {
  id: string
  full_name: string | null
  preferred_date: string | null
  pipeline_stage: string | null
}

interface ActionItem {
  id: string
  full_name: string | null
  label: string
}

export function TenantDashboard() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { clientId, companyName, loading: ctxLoading } = useClientContext(slug)
  const [userId, setUserId] = useState<string | null>(null)
  const [brand, setBrand] = useState<BrandInfo>({ logo_url: null, tagline: null })
  const [stats, setStats] = useState<Stats | null>(null)
  const [appointments, setAppointments] = useState<Appointment[]>([])
  const [actions, setActions] = useState<ActionItem[]>([])

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null))
  }, [])

  const { permission, subscribed, loading: pushLoading, subscribe } =
    usePushNotifications(clientId, userId)

  const showPushBanner = !subscribed && permission !== 'granted' && permission !== 'denied' && permission !== 'unsupported'

  // Fetch brand settings
  useEffect(() => {
    if (!clientId) return
    supabase
      .from('brand_settings')
      .select('logo_url, tagline')
      .eq('client_id', clientId)
      .single()
      .then(({ data }) => {
        if (data) setBrand({ logo_url: data.logo_url, tagline: data.tagline })
      })
  }, [clientId])

  // Fetch stats + data
  useEffect(() => {
    if (!clientId) return

    const now = new Date()
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()
    const today = now.toISOString().slice(0, 10)

    Promise.all([
      // This month revenue (paid invoices)
      supabase
        .from('invoices')
        .select('amount')
        .eq('client_id', clientId)
        .eq('status', 'paid')
        .gte('paid_at', monthStart),
      // Open leads (not terminal)
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .not('pipeline_stage', 'in', '(complete,lost,won)'),
      // Jobs scheduled
      supabase
        .from('leads')
        .select('id', { count: 'exact', head: true })
        .eq('client_id', clientId)
        .in('pipeline_stage', ['scheduled', 'in_progress']),
      // Unpaid invoices
      supabase
        .from('invoices')
        .select('amount')
        .eq('client_id', clientId)
        .eq('status', 'pending'),
      // Upcoming appointments
      supabase
        .from('leads')
        .select('id, full_name, preferred_date, pipeline_stage')
        .eq('client_id', clientId)
        .gte('preferred_date', today)
        .order('preferred_date', { ascending: true })
        .limit(5),
      // Leads needing estimate (recommended actions)
      supabase
        .from('leads')
        .select('id, full_name, estimates(id)')
        .eq('client_id', clientId)
        .not('pipeline_stage', 'in', '(complete,lost,won)')
        .limit(10),
    ]).then(([revRes, leadsRes, jobsRes, unpaidRes, apptRes, actionRes]) => {
      const revenue = (revRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)
      const unpaid = (unpaidRes.data ?? []).reduce((s, r) => s + Number(r.amount), 0)

      setStats({
        revenue,
        openLeads: leadsRes.count ?? 0,
        jobsScheduled: jobsRes.count ?? 0,
        unpaidAmount: unpaid,
      })
      setAppointments(apptRes.data ?? [])

      // Leads without any estimate
      const needEstimate = ((actionRes.data ?? []) as any[]).filter(
        l => !l.estimates || (Array.isArray(l.estimates) && l.estimates.length === 0)
      )
      setActions(needEstimate.map((l: any) => ({
        id: l.id,
        full_name: l.full_name,
        label: 'Create estimate',
      })))
    })
  }, [clientId])

  const loading = ctxLoading || !stats

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-[230px] bg-card border-r border-border flex flex-col shrink-0">
        {/* Brand */}
        <div className="p-4 border-b border-border">
          {brand.logo_url ? (
            <img src={brand.logo_url} alt={companyName ?? ''} className="w-12 h-12 rounded-lg object-cover mb-3" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-3">
              <span className="text-primary font-bold text-lg">{(companyName ?? slug ?? '?').charAt(0).toUpperCase()}</span>
            </div>
          )}
          <p className="font-bold text-sm uppercase tracking-wide leading-tight">{companyName ?? slug}</p>
          {brand.tagline && (
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">{brand.tagline}</p>
          )}
        </div>

        {/* Nav */}
        <nav className="p-2 space-y-0.5">
          {[
            { label: 'Dashboard', icon: BarChart2, path: `/${slug}/dashboard`, active: true },
            { label: 'Hub', icon: Users, path: `/${slug}/hub`, active: false },
            { label: 'Settings', icon: null, path: `/${slug}/settings`, active: false },
          ].map(({ label, path, active }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                active
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>

        {/* What matters right now */}
        <div className="m-3 mt-auto p-3 rounded-xl border-l-4 border-amber-400 bg-amber-500/10">
          <div className="flex items-center gap-2 mb-1.5">
            <Lightbulb className="w-4 h-4 text-amber-400 shrink-0" />
            <p className="text-xs font-bold text-amber-300">What matters right now</p>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {actions.length > 0
              ? `${actions.length} leads need estimates. Keep the pipeline moving.`
              : 'No urgent issues right now. Review new leads and keep the pipeline moving.'}
          </p>
        </div>
      </aside>

      {/* Right panel */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top bar */}
        <div className="h-14 border-b border-border flex items-center gap-3 px-4 shrink-0 bg-card">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search leads, jobs, invoices..."
              className="w-full max-w-md bg-secondary border border-border rounded-lg pl-4 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate(`/${slug}/hub`)}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity whitespace-nowrap"
            >
              + New Lead
            </button>
            <button className="px-3 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors whitespace-nowrap hidden lg:block">
              Schedule Crew
            </button>
            <button className="px-3 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors whitespace-nowrap hidden lg:block">
              New Estimate
            </button>
            <button className="flex items-center gap-1.5 px-3 py-2 border border-border rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors whitespace-nowrap hidden lg:block">
              <BarChart2 className="w-4 h-4" />
              Analytics
            </button>
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 overflow-auto p-5 space-y-5">
          {/* Welcome card */}
          <div className="bg-card border border-border rounded-xl p-5">
            {/* Welcome text */}
            <p className="text-xs font-bold tracking-widest text-primary uppercase mb-2">
              WELCOME TO YOUR DASHBOARD
            </p>
            <h1 className="text-2xl font-black uppercase leading-tight mb-1">
              MANAGE LEADS, ESTIMATES, AND PROJECTS FOR {(companyName ?? slug ?? '').toUpperCase()}.
            </h1>
            <p className="text-muted-foreground text-sm mb-5">
              Use the panels below to capture new leads, send estimates, schedule jobs, and keep customers updated.
            </p>

            {/* Push notification banner */}
            {showPushBanner && (
              <div className="flex items-center gap-3 p-3.5 bg-secondary rounded-xl mb-5">
                <Bell className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold">Enable Push Notifications</p>
                  <p className="text-xs text-muted-foreground">
                    Get notified instantly when a new consultation is booked — even when you're not in the app.
                  </p>
                </div>
                <button
                  onClick={() => {/* dismiss */}}
                  className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap shrink-0"
                >
                  Not Now
                </button>
                <button
                  onClick={subscribe}
                  disabled={pushLoading}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40 whitespace-nowrap shrink-0"
                >
                  Enable Notifications
                </button>
              </div>
            )}

            {/* Stat cards */}
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {[
                  {
                    label: 'THIS MONTH REVENUE',
                    value: `$${stats!.revenue.toLocaleString()}`,
                    sub: stats!.revenue === 0 ? 'No payments collected yet' : `$${stats!.revenue.toLocaleString()} collected`,
                  },
                  {
                    label: 'OPEN LEADS',
                    value: stats!.openLeads.toString(),
                    sub: `${stats!.openLeads} leads in pipeline`,
                  },
                  {
                    label: 'JOBS SCHEDULED',
                    value: stats!.jobsScheduled.toString(),
                    sub: stats!.jobsScheduled === 0 ? 'No jobs scheduled' : `${stats!.jobsScheduled} active`,
                  },
                  {
                    label: 'UNPAID INVOICES',
                    value: `$${stats!.unpaidAmount.toLocaleString()}`,
                    sub: stats!.unpaidAmount === 0 ? 'All caught up ✓' : `${stats!.unpaidAmount.toLocaleString()} outstanding`,
                  },
                ].map(({ label, value, sub }) => (
                  <div key={label} className="bg-background rounded-lg p-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
                    <p className="text-3xl font-black mb-1">{value}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Bottom row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Upcoming Appointments */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold mb-0.5">Upcoming Appointments</h2>
              <p className="text-xs text-muted-foreground mb-4">Scheduled jobs from the calendar</p>
              {appointments.length === 0 ? (
                <div className="flex items-center justify-center py-6 rounded-lg bg-secondary text-muted-foreground text-sm">
                  No upcoming appointments
                </div>
              ) : (
                <div className="space-y-2">
                  {appointments.map(appt => (
                    <div
                      key={appt.id}
                      onClick={() => navigate(`/${slug}/hub?lead=${appt.id}`)}
                      className="flex items-center justify-between p-3 rounded-lg bg-secondary hover:bg-accent transition-colors cursor-pointer"
                    >
                      <div>
                        <p className="text-sm font-medium">{appt.full_name ?? 'Unnamed'}</p>
                        <p className="text-xs text-muted-foreground capitalize">
                          {appt.pipeline_stage?.replace(/_/g, ' ')}
                        </p>
                      </div>
                      {appt.preferred_date && (
                        <span className="text-xs text-muted-foreground">
                          {new Date(appt.preferred_date + 'T12:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Recommended Actions */}
            <div className="bg-card border border-border rounded-xl p-5">
              <h2 className="font-semibold mb-0.5">Recommended Actions</h2>
              <p className="text-xs text-muted-foreground mb-4">
                {actions.length > 0 ? `${actions.length} items need attention` : 'All caught up'}
              </p>
              {actions.length === 0 ? (
                <div className="flex items-center justify-center py-6 rounded-lg bg-secondary text-muted-foreground text-sm">
                  No recommended actions
                </div>
              ) : (
                <div className="space-y-2">
                  {actions.slice(0, 5).map(action => (
                    <div key={action.id} className="flex items-start gap-3 p-3.5 bg-secondary rounded-xl">
                      <div className="relative shrink-0 mt-0.5">
                        <div className="w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                          <Clock className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-amber-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-0.5">
                          <span className="text-sm font-medium">{action.label}</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 uppercase">
                            OVERDUE
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          {action.full_name?.split(' ')[0] ?? 'Lead'} — Lead needs an estimate
                        </p>
                        <button
                          onClick={() => navigate(`/${slug}/hub?lead=${action.id}`)}
                          className="text-xs font-bold text-primary mt-1 hover:opacity-80 transition-opacity"
                        >
                          VIEW LEAD →
                        </button>
                      </div>
                      <button
                        onClick={() => navigate(`/${slug}/hub?lead=${action.id}`)}
                        className="text-muted-foreground hover:text-foreground shrink-0"
                      >
                        →
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
