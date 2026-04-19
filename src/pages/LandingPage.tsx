import { useNavigate } from 'react-router-dom'
import { Zap, Smartphone, DollarSign, Star } from 'lucide-react'

function PublicNav({ navigate }: { navigate: ReturnType<typeof useNavigate> }) {
  return (
    <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
      {/* Logo */}
      <div className="flex items-center gap-2.5">
        <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shrink-0">
          <span className="text-[#0A1628] font-black text-xs leading-none">CC</span>
        </div>
        <span className="font-bold text-sm uppercase tracking-wide text-primary hidden sm:block">
          Contractor Command Center
        </span>
      </div>

      {/* Links */}
      <div className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
        <a href="#" className="hover:text-foreground transition-colors">Who It's For</a>
        <a href="#" className="hover:text-foreground transition-colors">Features</a>
        <a href="#" className="hover:text-foreground transition-colors">How It Works</a>
        <a href="/pricing" onClick={e => { e.preventDefault(); navigate('/pricing') }} className="hover:text-foreground transition-colors">Pricing</a>
      </div>

      {/* Auth */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate('/login')}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
        >
          Log In
        </button>
        <button
          onClick={() => navigate('/login')}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
        >
          Get Started
        </button>
      </div>
    </nav>
  )
}

/* Browser mockup showing CRM pipeline table */
function BrowserMockup() {
  const rows = [
    { name: 'Maria Gonzalez', phone: '(305) 555-0961', stage: 'NEW LEAD', budget: '$10,000-$15K', age: '3d' },
    { name: 'James Wright',   phone: '(786) 555-0394', stage: 'CONTACTED', budget: '$50,000-$75K', age: '5d' },
    { name: 'Robert Davis',   phone: '(305) 555-0234', stage: 'ESTIMATE SENT', budget: '$8,000-$10K', age: '1d' },
    { name: 'Lisa Park',      phone: '(305) 555-097',  stage: 'PERMIT RECEIVED', budget: '$50,000-$75K', age: '12d' },
    { name: 'Sarah Chen',     phone: '(786) 555-0643', stage: 'IN PROGRESS', budget: '$20,000-$30K', age: '21d' },
    { name: 'Tom Nguyen',     phone: '(305) 555-0485', stage: 'COMPLETE', budget: '$5,000-$8K', age: '45d' },
  ]

  const stageColor = (stage: string) => {
    if (stage.includes('NEW')) return 'text-blue-400'
    if (stage.includes('COMPLETE')) return 'text-green-400'
    if (stage.includes('PROGRESS')) return 'text-amber-400'
    if (stage.includes('PERMIT')) return 'text-purple-400'
    return 'text-muted-foreground'
  }

  return (
    <div className="relative">
      {/* MacBook frame */}
      <div className="rounded-xl overflow-hidden shadow-2xl border border-white/10 bg-[#1C2B3A]">
        {/* Browser chrome */}
        <div className="bg-[#253545] px-3 py-2.5 flex items-center gap-2">
          <div className="flex gap-1.5">
            <div className="w-3 h-3 rounded-full bg-red-400" />
            <div className="w-3 h-3 rounded-full bg-yellow-400" />
            <div className="w-3 h-3 rounded-full bg-green-400" />
          </div>
          <div className="flex-1 mx-3 h-5 bg-[#1C2B3A] rounded text-[10px] text-muted-foreground flex items-center px-2">
            Pipeline Board
          </div>
        </div>

        {/* Table header */}
        <div className="px-3 pt-2 pb-1">
          <div className="grid grid-cols-5 text-[9px] font-bold text-muted-foreground uppercase tracking-wider px-2 pb-1 border-b border-white/10">
            <span>Name</span><span>Phone</span><span>Stage</span><span>Budget</span><span>Age</span>
          </div>
        </div>

        {/* Table rows */}
        <div className="px-3 pb-3 space-y-0.5">
          {rows.map((row, i) => (
            <div key={i} className="grid grid-cols-5 items-center px-2 py-1.5 rounded hover:bg-white/5 text-[9px]">
              <span className="text-foreground font-medium truncate">{row.name}</span>
              <span className="text-muted-foreground">{row.phone}</span>
              <span className={`font-semibold ${stageColor(row.stage)}`}>{row.stage}</span>
              <span className="text-muted-foreground">{row.budget}</span>
              <span className="text-muted-foreground">{row.age}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function LandingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <PublicNav navigate={navigate} />

      {/* Hero */}
      <section className="max-w-7xl mx-auto px-6 pt-16 pb-20 grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
        {/* Left */}
        <div>
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-secondary border border-border text-sm text-muted-foreground mb-8">
            <Zap className="w-3.5 h-3.5 text-primary" />
            Built for small contractors
          </div>

          {/* H1 */}
          <h1 className="text-5xl lg:text-6xl font-black uppercase leading-[1.05] mb-5">
            <span className="text-foreground">RUN YOUR WHOLE{'\n'}CONTRACTING BUSINESS</span>
            <br />
            <span className="text-primary">FROM YOUR PHONE</span>
          </h1>

          {/* Attribution */}
          <p className="text-sm text-muted-foreground mb-3">
            Powered by <span className="text-primary font-semibold">Kennedy & Associates</span>
          </p>

          {/* Body */}
          <p className="text-muted-foreground leading-relaxed mb-8 max-w-lg">
            Capture leads, send estimates, collect payments, and keep customers updated — without the spreadsheets, the sticky notes, or the chaos.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row gap-3 mb-8">
            <button
              onClick={() => navigate('/login')}
              className="flex items-center justify-center gap-2 px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:opacity-90 transition-opacity"
            >
              Start Free — No Credit Card Needed →
            </button>
            <button
              onClick={() => navigate('/demo')}
              className="px-6 py-3 border border-border text-foreground font-semibold rounded-lg hover:bg-accent transition-colors"
            >
              See How It Works
            </button>
          </div>

          {/* Trust */}
          <div className="flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-muted-foreground">
            {[
              'Set up in under 10 minutes',
              'No training required',
              'Cancel anytime',
              'Built for small contractors',
            ].map(item => (
              <span key={item} className="flex items-center gap-1.5">
                <span className="text-primary">✓</span> {item}
              </span>
            ))}
          </div>
        </div>

        {/* Right: mockup */}
        <div className="hidden lg:block">
          <BrowserMockup />
        </div>
      </section>

      {/* Feature tiles */}
      <section className="border-t border-border">
        <div className="max-w-7xl mx-auto px-6 py-14 grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[
            {
              icon: Smartphone,
              title: 'Works From Your Phone',
              body: 'iOS and Android — no app store needed',
            },
            {
              icon: Zap,
              title: 'Up & Running Same Day',
              body: 'No training. No onboarding calls. Just sign up.',
            },
            {
              icon: DollarSign,
              title: 'One Flat Monthly Price',
              body: 'No per-user fees. No surprise charges.',
            },
            {
              icon: Star,
              title: 'Real Human Support',
              body: 'We answer. Every time.',
            },
          ].map(({ icon: Icon, title, body }) => (
            <div key={title} className="bg-card border border-border rounded-xl p-6 text-center">
              <Icon className="w-8 h-8 text-primary mx-auto mb-4" />
              <p className="font-bold text-foreground mb-2">{title}</p>
              <p className="text-sm text-muted-foreground">{body}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
