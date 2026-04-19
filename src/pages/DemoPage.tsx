import { useState } from 'react'
import { X, Bell } from 'lucide-react'
import { useNavigate } from 'react-router-dom'

const TOUR_STEPS = [
  {
    title: 'Your Business Overview',
    body: 'This is your command center — everything about your business at a glance.',
  },
  {
    title: 'Your Pipeline',
    body: 'Track every lead from first contact to final payment in one place.',
  },
  {
    title: 'Create Your First Lead',
    body: 'Capture a new lead in seconds — name, project type, address, and more.',
  },
  {
    title: 'Send an Estimate',
    body: 'Build and send professional estimates directly from the lead workspace.',
  },
]

const DEMO_STATS = [
  { label: 'THIS MONTH REVENUE', value: '$0', sub: 'No payments collected yet' },
  { label: 'OPEN LEADS', value: '0', sub: '0 leads in pipeline' },
  { label: 'JOBS SCHEDULED', value: '0', sub: 'No jobs scheduled' },
  { label: 'UNPAID INVOICES', value: '$0', sub: 'All caught up ✓' },
]

export function DemoPage() {
  const navigate = useNavigate()
  const [showModal, setShowModal] = useState(true)
  const [tourStep, setTourStep] = useState(0)
  const [showTour, setShowTour] = useState(false)

  const startTour = () => {
    setShowModal(false)
    setShowTour(true)
  }

  return (
    <div className="min-h-screen bg-background text-foreground relative">
      {/* Demo banner — gray, NOT gold */}
      <div className="fixed top-0 left-0 right-0 z-50 h-9 bg-[#1E2A38] border-b border-white/10 flex items-center px-4 gap-2">
        <span className="w-2 h-2 rounded-full bg-green-400 shrink-0" />
        <span className="text-xs text-[#B0BEC5]">
          Live Demo — Explore freely. Changes reset automatically. No signup required.
        </span>
        <button
          onClick={() => navigate('/')}
          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
        >
          Exit Demo
        </button>
      </div>

      {/* Sidebar */}
      <div className="pt-9 flex min-h-screen">
        <aside className="w-[230px] bg-card border-r border-border flex flex-col shrink-0">
          <div className="p-4 border-b border-border">
            {/* K&A avatar */}
            <div className="w-12 h-12 rounded-lg bg-primary flex items-center justify-center mb-3">
              <span className="text-primary-foreground font-black text-xl">K</span>
            </div>
            <p className="font-black text-sm uppercase tracking-wide">KENNEDY & ASSOCIATES</p>
            <p className="text-[10px] text-muted-foreground uppercase tracking-widest mt-0.5">
              CONSTRUCTION INTELLIGENCE PLATFORM
            </p>
          </div>
          <nav className="p-2 space-y-0.5">
            {['Dashboard', 'Hub', 'Settings'].map((label, i) => (
              <div
                key={label}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium ${
                  i === 0
                    ? 'bg-primary text-primary-foreground'
                    : 'text-muted-foreground'
                }`}
              >
                {label}
              </div>
            ))}
          </nav>
          <div className="m-3 mt-auto p-3 rounded-xl border-l-4 border-amber-400 bg-amber-500/10">
            <p className="text-xs font-bold text-amber-300 mb-1">What matters right now</p>
            <p className="text-xs text-muted-foreground">No urgent issues right now. Review new leads and keep the pipeline moving.</p>
          </div>
        </aside>

        {/* Main content — dimmed when modal open */}
        <div className={`flex-1 transition-opacity ${showModal ? 'opacity-30 pointer-events-none' : 'opacity-100'}`}>
          <div className="p-6">
            <div className="bg-card border border-border rounded-xl p-5">
              <p className="text-xs font-bold tracking-widest text-primary uppercase mb-2">WELCOME TO YOUR DASHBOARD</p>
              <h1 className="text-2xl font-black uppercase mb-4">CAPTURE LEADS, BUILD ESTIMATES, AND PUBLISH PORTAL UPDATES.</h1>

              {/* Push banner */}
              <div className="flex items-center gap-3 p-3.5 bg-secondary rounded-xl mb-5">
                <Bell className="w-5 h-5 text-primary shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-bold">Enable Push Notifications</p>
                  <p className="text-xs text-muted-foreground">Get notified instantly when a new consultation is booked.</p>
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                {DEMO_STATS.map(({ label, value, sub }) => (
                  <div key={label} className="bg-background rounded-lg p-4">
                    <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-2">{label}</p>
                    <p className="text-3xl font-black mb-1">{value}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Onboarding modal */}
      {showModal && (
        <div className="fixed inset-0 z-40 flex items-center justify-center p-4 pt-9">
          <div className="bg-white text-gray-900 rounded-2xl shadow-2xl w-full max-w-lg p-8 relative">
            <button
              onClick={() => setShowModal(false)}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>

            <p className="text-xs font-bold text-[#F5C542] uppercase tracking-widest mb-3">
              LEAD WORKFLOW UPGRADE
            </p>
            <h2 className="text-xl font-black uppercase leading-tight mb-3">
              CAPTURE LEADS, BUILD ESTIMATES, AND PUBLISH PORTAL UPDATES.
            </h2>
            <p className="text-gray-500 text-sm mb-6">
              Run the full client workflow from intake to approval while keeping customers updated inside their portal.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-6">
              {DEMO_STATS.map(({ label, value, sub }) => (
                <div key={label} className="bg-[#0A1628] rounded-lg p-3">
                  <p className="text-[9px] font-bold text-[#8A9BB0] uppercase tracking-widest mb-1">{label}</p>
                  <p className="text-2xl font-black text-white mb-0.5">{value}</p>
                  <p className="text-[10px] text-[#8A9BB0]">{sub}</p>
                </div>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 border border-gray-200 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50"
              >
                Skip for now
              </button>
              <button
                onClick={startTour}
                className="flex-1 py-2.5 bg-[#F5C542] text-[#0A1628] rounded-lg text-sm font-bold hover:opacity-90"
              >
                Take the Tour
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Product tour tooltip */}
      {showTour && (
        <div className="fixed bottom-8 right-8 z-50 w-72 bg-card border border-border rounded-xl shadow-2xl p-5">
          <div className="flex items-center justify-between mb-3">
            <div className="flex gap-1">
              {TOUR_STEPS.map((_, i) => (
                <div
                  key={i}
                  className={`w-2 h-2 rounded-full ${i === tourStep ? 'bg-primary' : 'bg-muted'}`}
                />
              ))}
            </div>
            <span className="text-xs text-muted-foreground">{tourStep + 1}/{TOUR_STEPS.length}</span>
          </div>

          <h3 className="font-bold mb-2">{TOUR_STEPS[tourStep].title}</h3>
          <p className="text-sm text-muted-foreground mb-5">{TOUR_STEPS[tourStep].body}</p>

          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowTour(false)}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Skip tour
            </button>
            <button
              onClick={() => {
                if (tourStep < TOUR_STEPS.length - 1) setTourStep(t => t + 1)
                else setShowTour(false)
              }}
              className="px-4 py-2 bg-secondary text-foreground rounded-lg text-sm font-medium hover:bg-accent transition-colors"
            >
              {tourStep < TOUR_STEPS.length - 1 ? 'Next ›' : 'Done'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
