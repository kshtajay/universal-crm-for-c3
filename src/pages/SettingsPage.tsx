import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { BarChart2, Users, Settings, Building2, Bell, Palette, CreditCard, Check } from 'lucide-react'
import { useClientContext } from '../hooks/useClientContext'
import { supabase } from '../integrations/supabase/client'

interface BrandForm {
  logo_url: string
  tagline: string
  primary_color: string
}

interface DepositRule {
  id: string | null
  deposit_type: 'fixed' | 'percentage'
  deposit_amount: number
  deposit_pct: number
}

interface ClientInfo {
  contractor_type: string | null
  package_name: string | null
}

const CONTRACTOR_TYPES = [
  'general_contractor', 'roofing', 'plumbing', 'electrical', 'hvac',
  'painting', 'flooring', 'landscaping', 'concrete', 'fencing', 'solar', 'other',
]

export function SettingsPage() {
  const { slug } = useParams<{ slug: string }>()
  const navigate = useNavigate()
  const { clientId, companyName, loading: ctxLoading } = useClientContext(slug)

  const [brand, setBrand] = useState<BrandForm>({ logo_url: '', tagline: '', primary_color: '#F5C542' })
  const [deposit, setDeposit] = useState<DepositRule>({ id: null, deposit_type: 'fixed', deposit_amount: 150, deposit_pct: 25 })
  const [clientInfo, setClientInfo] = useState<ClientInfo>({ contractor_type: null, package_name: null })
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState<string | null>(null)
  const [saved, setSaved] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (!clientId) return
    Promise.all([
      supabase.from('brand_settings').select('logo_url, tagline, primary_color').eq('client_id', clientId).single(),
      supabase.from('deposit_rules').select('id, deposit_type, deposit_amount, deposit_pct').eq('client_id', clientId).eq('is_active', true).single(),
      supabase.from('clients').select('contractor_type, packages(name)').eq('id', clientId).single(),
    ]).then(([brandRes, depRes, clientRes]) => {
      if (brandRes.data) {
        setBrand({
          logo_url: brandRes.data.logo_url ?? '',
          tagline: brandRes.data.tagline ?? '',
          primary_color: brandRes.data.primary_color ?? '#F5C542',
        })
      }
      if (depRes.data) {
        setDeposit({
          id: depRes.data.id,
          deposit_type: depRes.data.deposit_type as 'fixed' | 'percentage',
          deposit_amount: Number(depRes.data.deposit_amount ?? 150),
          deposit_pct: Number(depRes.data.deposit_pct ?? 25),
        })
      }
      if (clientRes.data) {
        setClientInfo({
          contractor_type: clientRes.data.contractor_type,
          package_name: (clientRes.data as any).packages?.name ?? null,
        })
      }
      setLoading(false)
    })
  }, [clientId])

  const flash = (key: string) => {
    setSaved(key)
    setTimeout(() => setSaved(null), 2000)
  }

  const saveBrand = async () => {
    if (!clientId) return
    setSaving('brand')
    await supabase.from('brand_settings').upsert({
      client_id: clientId,
      logo_url: brand.logo_url || null,
      tagline: brand.tagline || null,
      primary_color: brand.primary_color,
    }, { onConflict: 'client_id' })
    setSaving(null)
    flash('brand')
  }

  const saveDeposit = async () => {
    if (!clientId) return
    setSaving('deposit')
    if (deposit.id) {
      await supabase.from('deposit_rules').update({
        deposit_type: deposit.deposit_type,
        deposit_amount: deposit.deposit_type === 'fixed' ? deposit.deposit_amount : null,
        deposit_pct: deposit.deposit_type === 'percentage' ? deposit.deposit_pct : null,
      }).eq('id', deposit.id)
    } else {
      const { data } = await supabase.from('deposit_rules').insert({
        client_id: clientId,
        deposit_type: deposit.deposit_type,
        deposit_amount: deposit.deposit_type === 'fixed' ? deposit.deposit_amount : null,
        deposit_pct: deposit.deposit_type === 'percentage' ? deposit.deposit_pct : null,
        is_active: true,
      }).select('id').single()
      if (data) setDeposit(prev => ({ ...prev, id: data.id }))
    }
    setSaving(null)
    flash('deposit')
  }

  const saveContractorType = async (type: string) => {
    if (!clientId) return
    await supabase.from('clients').update({ contractor_type: type }).eq('id', clientId)
    setClientInfo(prev => ({ ...prev, contractor_type: type }))
    flash('type')
  }

  const uploadLogo = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file || !clientId) return
    setUploading(true)
    const path = `logos/${clientId}/${Date.now()}_${file.name}`
    await supabase.storage.from('job-files').upload(path, file, { upsert: true })
    const { data: { publicUrl } } = supabase.storage.from('job-files').getPublicUrl(path)
    setBrand(prev => ({ ...prev, logo_url: publicUrl }))
    setUploading(false)
  }

  const navItems = [
    { label: 'Dashboard', icon: BarChart2, path: `/${slug}/dashboard` },
    { label: 'Hub', icon: Users, path: `/${slug}/hub` },
    { label: 'Settings', icon: Settings, path: `/${slug}/settings` },
  ]

  if (ctxLoading || loading) return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      {/* Sidebar */}
      <aside className="w-[230px] bg-card border-r border-border flex flex-col shrink-0">
        <div className="p-4 border-b border-border">
          <div className="w-12 h-12 rounded-lg bg-primary/20 flex items-center justify-center mb-3">
            <span className="text-primary font-bold text-lg">{(companyName ?? slug ?? '?').charAt(0).toUpperCase()}</span>
          </div>
          <p className="font-bold text-sm uppercase tracking-wide">{companyName ?? slug}</p>
        </div>
        <nav className="p-2 space-y-0.5">
          {navItems.map(({ label, path }) => (
            <button
              key={label}
              onClick={() => navigate(path)}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors text-left ${
                path === `/${slug}/settings`
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-accent'
              }`}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      {/* Main */}
      <div className="flex-1 overflow-auto">
        <div className="border-b border-border bg-card px-6 h-14 flex items-center">
          <h1 className="font-bold text-base">Settings</h1>
        </div>

        <div className="p-6 space-y-6 max-w-2xl">
          {/* Brand Settings */}
          <section className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Palette className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Brand Settings</h2>
            </div>

            {/* Logo */}
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-2">Logo</label>
              <div className="flex items-center gap-3">
                {brand.logo_url ? (
                  <img src={brand.logo_url} alt="Logo" className="w-14 h-14 rounded-lg object-cover border border-border" />
                ) : (
                  <div className="w-14 h-14 rounded-lg bg-secondary border border-dashed border-border flex items-center justify-center">
                    <Building2 className="w-5 h-5 text-muted-foreground" />
                  </div>
                )}
                <div>
                  <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={uploadLogo} />
                  <button
                    onClick={() => fileRef.current?.click()}
                    disabled={uploading}
                    className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent transition-colors disabled:opacity-40"
                  >
                    {uploading ? 'Uploading…' : 'Upload Logo'}
                  </button>
                  {brand.logo_url && (
                    <button onClick={() => setBrand(p => ({ ...p, logo_url: '' }))} className="ml-2 text-xs text-muted-foreground hover:text-destructive">
                      Remove
                    </button>
                  )}
                </div>
              </div>
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">Tagline</label>
              <input
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                placeholder="e.g. Quality Work, On Time"
                value={brand.tagline}
                onChange={e => setBrand(p => ({ ...p, tagline: e.target.value }))}
              />
            </div>

            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">Brand Color</label>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  className="w-10 h-10 rounded-lg border border-border cursor-pointer bg-transparent"
                  value={brand.primary_color}
                  onChange={e => setBrand(p => ({ ...p, primary_color: e.target.value }))}
                />
                <input
                  className="w-32 bg-secondary border border-border rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  value={brand.primary_color}
                  onChange={e => setBrand(p => ({ ...p, primary_color: e.target.value }))}
                />
                <div className="w-8 h-8 rounded-full border border-border" style={{ background: brand.primary_color }} />
              </div>
            </div>

            <div className="flex justify-end">
              <button
                onClick={saveBrand}
                disabled={saving === 'brand'}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
              >
                {saved === 'brand' ? <><Check className="w-3.5 h-3.5" /> Saved</> : saving === 'brand' ? 'Saving…' : 'Save Brand'}
              </button>
            </div>
          </section>

          {/* Contractor Type */}
          <section className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Business Type</h2>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">Contractor Type</label>
              <select
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary capitalize"
                value={clientInfo.contractor_type ?? ''}
                onChange={e => saveContractorType(e.target.value)}
              >
                <option value="">Select type…</option>
                {CONTRACTOR_TYPES.map(t => (
                  <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                ))}
              </select>
              {saved === 'type' && <p className="text-xs text-green-400 mt-1">Saved ✓</p>}
            </div>
          </section>

          {/* Deposit / Consultation Fee */}
          <section className="bg-card border border-border rounded-xl p-6 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <CreditCard className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Consultation Fee / Deposit</h2>
            </div>
            <div>
              <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">Fee Type</label>
              <select
                className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                value={deposit.deposit_type}
                onChange={e => setDeposit(p => ({ ...p, deposit_type: e.target.value as 'fixed' | 'percentage' }))}
              >
                <option value="fixed">Fixed amount</option>
                <option value="percentage">Percentage of estimate</option>
              </select>
            </div>
            {deposit.deposit_type === 'fixed' ? (
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">Amount ($)</label>
                <input
                  type="number"
                  min={0}
                  step={0.01}
                  className="w-40 bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={deposit.deposit_amount}
                  onChange={e => setDeposit(p => ({ ...p, deposit_amount: Number(e.target.value) }))}
                />
              </div>
            ) : (
              <div>
                <label className="text-xs font-bold text-muted-foreground uppercase tracking-wide block mb-1.5">Percentage (%)</label>
                <input
                  type="number"
                  min={0}
                  max={100}
                  step={1}
                  className="w-40 bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  value={deposit.deposit_pct}
                  onChange={e => setDeposit(p => ({ ...p, deposit_pct: Number(e.target.value) }))}
                />
              </div>
            )}
            <div className="flex justify-end">
              <button
                onClick={saveDeposit}
                disabled={saving === 'deposit'}
                className="flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
              >
                {saved === 'deposit' ? <><Check className="w-3.5 h-3.5" /> Saved</> : saving === 'deposit' ? 'Saving…' : 'Save'}
              </button>
            </div>
          </section>

          {/* Plan */}
          <section className="bg-card border border-border rounded-xl p-6">
            <div className="flex items-center gap-2 mb-4">
              <Bell className="w-4 h-4 text-primary" />
              <h2 className="font-semibold">Current Plan</h2>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold">{clientInfo.package_name ?? 'No plan'}</p>
                <p className="text-xs text-muted-foreground mt-0.5">Contact support to change your plan.</p>
              </div>
              <span className="px-3 py-1 rounded-full bg-primary/20 text-primary text-xs font-bold uppercase">
                {clientInfo.package_name ?? 'Free'}
              </span>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
