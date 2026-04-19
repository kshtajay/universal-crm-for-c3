import { useNavigate } from 'react-router-dom'
import { Check } from 'lucide-react'

const PLANS = [
  {
    name: 'BASIC',
    price: 97,
    tagline: 'For contractors just getting started',
    popular: false,
    features: [
      'Lead Capture & Intake',
      'CRM Pipeline Board',
      'Estimate Builder',
    ],
    moreCount: null,
    cta: 'Start Free Trial',
    ctaStyle: 'outline' as const,
  },
  {
    name: 'PROFESSIONAL',
    price: 197,
    tagline: 'For growing contractor businesses',
    popular: true,
    features: [
      'Lead Capture & Intake',
      'CRM Pipeline Board',
      'Customer Portal',
      'Daily Logs',
      'Estimate Builder',
      'Invoicing & Payments',
      'Job Costing',
      'Job Scheduling & Calendar',
    ],
    moreCount: 3,
    cta: 'Start Free Trial',
    ctaStyle: 'gold' as const,
  },
  {
    name: 'ENTERPRISE',
    price: 397,
    tagline: 'For established contractor operations',
    popular: false,
    features: [
      'Lead Capture & Intake',
      'CRM Pipeline Board',
      'Customer Portal',
      'Daily Logs',
      'Estimate Builder',
      'Invoicing & Payments',
      'Job Costing',
      'Job Scheduling & Calendar',
    ],
    moreCount: 10,
    cta: 'Contact Sales',
    ctaStyle: 'outline' as const,
  },
]

export function PricingPage() {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Nav */}
      <nav className="flex items-center justify-between px-6 py-4 border-b border-white/10">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shrink-0">
            <span className="text-[#0A1628] font-black text-xs">CC</span>
          </div>
          <span className="font-bold text-sm uppercase tracking-wide text-primary hidden sm:block">
            Contractor Command Center
          </span>
        </div>
        <div className="hidden md:flex items-center gap-7 text-sm text-muted-foreground">
          <a href="/" onClick={e => { e.preventDefault(); navigate('/') }} className="hover:text-foreground transition-colors">Who It's For</a>
          <a href="#" className="hover:text-foreground transition-colors">Features</a>
          <a href="#" className="hover:text-foreground transition-colors">How It Works</a>
          <a href="/pricing" className="text-foreground font-medium">Pricing</a>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/login')} className="text-sm text-muted-foreground hover:text-foreground transition-colors">Log In</button>
          <button onClick={() => navigate('/login')} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity">Get Started</button>
        </div>
      </nav>

      {/* Hero */}
      <div className="text-center pt-16 pb-12 px-6">
        <h1 className="text-4xl lg:text-5xl font-black uppercase tracking-tight mb-4">
          <span className="text-foreground">ONE SIMPLE PRICE. </span>
          <span className="text-primary">EVERYTHING INCLUDED.</span>
        </h1>
        <p className="text-muted-foreground text-lg max-w-xl mx-auto mb-8">
          No per-user fees. No hidden charges. Just a tool that helps you run a better business.
        </p>
        <button
          onClick={() => navigate('/demo')}
          className="inline-flex items-center gap-2 px-6 py-2.5 border border-border rounded-full text-sm font-medium hover:bg-accent transition-colors"
        >
          ▷ Try the Live Demo
        </button>
      </div>

      {/* Pricing cards */}
      <div className="max-w-5xl mx-auto px-6 pb-20">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-start">
          {PLANS.map(plan => (
            <div key={plan.name} className="relative">
              {/* Most Popular badge */}
              {plan.popular && (
                <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                  <span className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-primary text-primary-foreground text-xs font-bold uppercase tracking-wider rounded-full">
                    ✦ MOST POPULAR
                  </span>
                </div>
              )}

              <div className={`bg-card rounded-xl p-6 ${plan.popular ? 'border-2 border-primary' : 'border border-border'}`}>
                {/* Name */}
                <h2 className="text-xl font-black uppercase mb-1">{plan.name}</h2>
                <p className="text-sm text-muted-foreground mb-5">{plan.tagline}</p>

                {/* Price */}
                <div className="flex items-baseline gap-1 mb-6">
                  <span className="text-5xl font-black">${plan.price}</span>
                  <span className="text-muted-foreground text-sm">/mo</span>
                </div>

                {/* Features */}
                <ul className="space-y-2.5 mb-6">
                  {plan.features.map(f => (
                    <li key={f} className="flex items-center gap-2.5 text-sm">
                      <Check className="w-4 h-4 text-primary shrink-0" />
                      {f}
                    </li>
                  ))}
                  {plan.moreCount && (
                    <li className="text-sm text-primary font-semibold pl-6.5">
                      +{plan.moreCount} more features
                    </li>
                  )}
                </ul>

                {/* CTA */}
                <button
                  onClick={() => navigate('/login')}
                  className={`w-full py-3 rounded-lg text-sm font-semibold transition-opacity hover:opacity-90 ${
                    plan.ctaStyle === 'gold'
                      ? 'bg-primary text-primary-foreground'
                      : 'border border-border text-foreground hover:bg-accent'
                  }`}
                >
                  {plan.cta}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
