import { useNavigate } from 'react-router-dom'

interface AdminViewingBannerProps {
  tenantName: string
  agentName: string
}

export function AdminViewingBanner({ tenantName, agentName }: AdminViewingBannerProps) {
  const navigate = useNavigate()

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-[#F5C542] text-[#1A1A1A] h-10 flex items-center justify-between px-4 text-sm font-semibold shadow-md">
      <span>
        You are viewing <strong>{tenantName}</strong> as K&A — {agentName}
      </span>
      <button
        onClick={() => navigate('/admin/clients')}
        className="text-xs font-bold underline hover:opacity-70 transition-opacity whitespace-nowrap"
      >
        Return to Admin Console
      </button>
    </div>
  )
}
