import { useState, useEffect, useCallback } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../../integrations/supabase/client'
import { OverviewTab } from './tabs/OverviewTab'
import { IntakeTab } from './tabs/IntakeTab'
import { TasksTab } from './tabs/TasksTab'
import { WeatherTab } from './tabs/WeatherTab'
import { MaterialsTab } from './tabs/MaterialsTab'
import { EstimateTab } from './tabs/EstimateTab'
import { ContractTab } from './tabs/ContractTab'
import { InvoiceTab } from './tabs/InvoiceTab'
import { FilesTab } from './tabs/FilesTab'
import { NotesTab } from './tabs/NotesTab'
import { DailyLogsTab } from './tabs/DailyLogsTab'
import { PermitTab } from './tabs/PermitTab'
import { DrawScheduleTab } from './tabs/DrawScheduleTab'
import { ChangeOrderTab } from './tabs/ChangeOrderTab'
import { PortalPreviewTab } from './tabs/PortalPreviewTab'
import { StubTab } from './tabs/StubTab'

interface WorkspaceTab {
  tab_key: string
  label: string
  display_order: number
  visible_for_types: string[]
}

interface Props {
  leadId: string
  clientId: string
  contractorType: string | null
  onClose: () => void
}

const DEFAULT_TABS: WorkspaceTab[] = [
  { tab_key: 'overview', label: 'Overview', display_order: 1, visible_for_types: [] },
  { tab_key: 'intake', label: 'Intake', display_order: 2, visible_for_types: [] },
  { tab_key: 'estimate', label: 'Estimate', display_order: 3, visible_for_types: [] },
  { tab_key: 'contract', label: 'Contract', display_order: 4, visible_for_types: [] },
  { tab_key: 'invoice', label: 'Invoice', display_order: 5, visible_for_types: [] },
  { tab_key: 'tasks', label: 'Tasks', display_order: 6, visible_for_types: [] },
  { tab_key: 'files', label: 'Files', display_order: 7, visible_for_types: [] },
  { tab_key: 'notes', label: 'Notes', display_order: 8, visible_for_types: [] },
  { tab_key: 'daily_logs', label: 'Daily Logs', display_order: 9, visible_for_types: [] },
  { tab_key: 'portal', label: 'Portal', display_order: 10, visible_for_types: [] },
]

export function JobWorkspaceModal({ leadId, clientId, contractorType, onClose }: Props) {
  const [tabs, setTabs] = useState<WorkspaceTab[]>(DEFAULT_TABS)
  const [activeTab, setActiveTab] = useState('overview')
  const [leadName, setLeadName] = useState<string | null>(null)

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  // Load workspace tabs from DB (filtered by contractor type)
  useEffect(() => {
    supabase
      .from('workspace_tabs')
      .select('tab_key, label, display_order, visible_for_types')
      .order('display_order', { ascending: true })
      .then(({ data }) => {
        if (!data?.length) return
        const visible = data.filter((t: WorkspaceTab) =>
          t.visible_for_types.length === 0 ||
          (contractorType && t.visible_for_types.includes(contractorType))
        )
        if (visible.length) setTabs(visible)
      })
  }, [contractorType])

  // Load lead name for header
  useEffect(() => {
    supabase
      .from('leads')
      .select('full_name')
      .eq('id', leadId)
      .single()
      .then(({ data }) => setLeadName(data?.full_name ?? null))
  }, [leadId])

  const renderTab = useCallback(() => {
    switch (activeTab) {
      case 'overview':     return <OverviewTab leadId={leadId} />
      case 'intake':       return <IntakeTab leadId={leadId} />
      case 'estimate':     return <EstimateTab leadId={leadId} clientId={clientId} />
      case 'contract':     return <ContractTab leadId={leadId} clientId={clientId} />
      case 'invoice':      return <InvoiceTab leadId={leadId} clientId={clientId} />
      case 'tasks':        return <TasksTab leadId={leadId} clientId={clientId} />
      case 'files':        return <FilesTab leadId={leadId} clientId={clientId} />
      case 'notes':        return <NotesTab leadId={leadId} clientId={clientId} />
      case 'daily_logs':   return <DailyLogsTab leadId={leadId} clientId={clientId} />
      case 'permits':      return <PermitTab leadId={leadId} clientId={clientId} />
      case 'draw_schedule':return <DrawScheduleTab leadId={leadId} clientId={clientId} />
      case 'change_orders':return <ChangeOrderTab leadId={leadId} clientId={clientId} />
      case 'weather':      return <WeatherTab leadId={leadId} />
      case 'materials':    return <MaterialsTab leadId={leadId} clientId={clientId} />
      case 'portal':       return <PortalPreviewTab leadId={leadId} clientId={clientId} />
      default: {
        const tab = tabs.find(t => t.tab_key === activeTab)
        return <StubTab label={tab?.label ?? activeTab} />
      }
    }
  }, [activeTab, leadId, clientId, tabs])

  return (
    <div className="fixed inset-0 z-50 flex items-stretch">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative ml-auto w-full max-w-3xl h-full bg-card border-l border-border flex flex-col shadow-2xl">
        {/* Header */}
        <div className="flex items-center gap-3 px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex-1 min-w-0">
            <h2 className="font-semibold text-foreground truncate">{leadName ?? 'Job Workspace'}</h2>
            <p className="text-xs text-muted-foreground font-mono">{leadId.slice(0, 8)}…</p>
          </div>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab bar */}
        <div className="flex items-end gap-0 px-5 border-b border-border shrink-0 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.tab_key}
              onClick={() => setActiveTab(tab.tab_key)}
              className={`px-3 py-2.5 text-sm font-medium border-b-2 transition-colors whitespace-nowrap ${
                activeTab === tab.tab_key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {renderTab()}
        </div>
      </div>
    </div>
  )
}
