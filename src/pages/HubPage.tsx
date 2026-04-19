import { useState, useEffect } from 'react'
import { useSearchParams, useParams } from 'react-router-dom'

export function HubPage() {
  const { slug } = useParams<{ slug: string }>()
  const [searchParams, setSearchParams] = useSearchParams()
  const [selectedLeadId, setSelectedLeadId] = useState<string | null>(
    searchParams.get('lead')
  )

  const openLead = (leadId: string) => {
    setSelectedLeadId(leadId)
    setSearchParams({ lead: leadId })
  }

  const closeLead = () => {
    setSelectedLeadId(null)
    setSearchParams({})
  }

  // Sync state when browser back button clears the ?lead= param
  useEffect(() => {
    const leadParam = searchParams.get('lead')
    if (!leadParam && selectedLeadId) {
      setSelectedLeadId(null)
    } else if (leadParam && leadParam !== selectedLeadId) {
      setSelectedLeadId(leadParam)
    }
  }, [searchParams])

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Top bar */}
      <header className="h-14 border-b border-border flex items-center px-4 gap-4">
        <span className="font-bold text-gold-DEFAULT">{slug}</span>
        <span className="text-muted-foreground text-sm">Command Center</span>
        <div className="ml-auto">
          <button
            onClick={() => openLead('test-lead-id')}
            className="px-3 py-1.5 bg-primary text-primary-foreground text-sm rounded-lg font-semibold"
          >
            + New Lead
          </button>
        </div>
      </header>

      <div className="flex h-[calc(100vh-56px)]">
        {/* Left sidebar */}
        <aside className="w-56 border-r border-border p-4 hidden md:block">
          <nav className="space-y-1 text-sm">
            {['Pipeline', 'My Jobs', 'Calendar', 'Reports', 'Settings'].map(item => (
              <div key={item} className="px-3 py-2 rounded-lg hover:bg-accent cursor-pointer text-muted-foreground hover:text-foreground">
                {item}
              </div>
            ))}
          </nav>
        </aside>

        {/* Main kanban area */}
        <main className="flex-1 overflow-auto p-6">
          <p className="text-muted-foreground text-sm">
            Kanban board — stages load from <code>workflow_stages</code> table.
          </p>
          {selectedLeadId && (
            <div className="mt-4 p-4 border border-border rounded-xl bg-card">
              <p className="text-sm font-mono text-primary">Lead: {selectedLeadId}</p>
              <button onClick={closeLead} className="mt-2 text-xs text-muted-foreground hover:text-foreground">
                Close (Escape)
              </button>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
