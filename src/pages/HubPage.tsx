import { useState, useEffect } from 'react'
import { useSearchParams, useParams } from 'react-router-dom'
import { Plus } from 'lucide-react'
import { useClientContext } from '../hooks/useClientContext'
import { KanbanBoard } from '../components/kanban/KanbanBoard'
import { JobWorkspaceModal } from '../components/workspace/JobWorkspaceModal'
import { NewLeadIntakePanel } from '../components/hub/NewLeadIntakePanel'

export function HubPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(searchParams.get('lead'))
  const [showIntake, setShowIntake] = useState(false)

  const { clientId, contractorType, loading: ctxLoading } = useClientContext(slug)

  const openLead = (leadId: string) => {
    setSelectedLeadId(leadId)
    setSearchParams({ lead: leadId })
  }

  const closeLead = () => {
    setSelectedLeadId(null)
    setSearchParams({})
  }

  // Sync with browser back button
  useEffect(() => {
    const leadParam = searchParams.get('lead')
    if (!leadParam && selectedLeadId) setSelectedLeadId(null)
    else if (leadParam && leadParam !== selectedLeadId) setSelectedLeadId(leadParam)
  }, [searchParams])

  const handleLeadCreated = (leadId: string) => {
    setShowIntake(false)
    openLead(leadId)
  }

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      {/* Top bar */}
      <header className="h-14 border-b border-border flex items-center px-4 gap-4 shrink-0">
        <span className="font-bold text-primary">{slug}</span>
        <span className="text-muted-foreground text-sm hidden sm:block">Command Center</span>
        <div className="ml-auto">
          <button
            onClick={() => setShowIntake(true)}
            disabled={ctxLoading || !clientId}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            <Plus className="w-4 h-4" />
            New Lead
          </button>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <aside className="w-52 border-r border-border p-3 hidden md:flex flex-col shrink-0">
          <nav className="space-y-0.5 text-sm">
            {[
              { label: 'Pipeline', active: true },
              { label: 'My Jobs', active: false },
              { label: 'Calendar', active: false },
              { label: 'Reports', active: false },
              { label: 'Settings', active: false },
            ].map(({ label, active }) => (
              <div
                key={label}
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

        {/* Kanban */}
        <main className="flex-1 overflow-auto">
          {ctxLoading && (
            <div className="flex items-center justify-center h-full">
              <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}
          {!ctxLoading && clientId && (
            <KanbanBoard clientId={clientId} onLeadClick={openLead} />
          )}
          {!ctxLoading && !clientId && (
            <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
              Client not found for slug "{slug}"
            </div>
          )}
        </main>
      </div>

      {/* Job Workspace Modal */}
      {selectedLeadId && clientId && (
        <JobWorkspaceModal
          leadId={selectedLeadId}
          clientId={clientId}
          contractorType={contractorType}
          onClose={closeLead}
        />
      )}

      {/* New Lead intake panel */}
      {showIntake && clientId && (
        <NewLeadIntakePanel
          clientId={clientId}
          onClose={() => setShowIntake(false)}
          onLeadCreated={handleLeadCreated}
        />
      )}
    </div>
  )
}
