import { useParams } from 'react-router-dom'
import { AdminViewingBanner } from '@/components/AdminViewingBanner'

export function AdminClientView() {
  const { slug } = useParams<{ slug: string }>()

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AdminViewingBanner tenantName={slug ?? ''} agentName="K&A Admin" />
      <div className="pt-12 p-6">
        <h1 className="text-2xl font-bold">Viewing: {slug}</h1>
        <p className="text-muted-foreground text-sm mt-2">Tenant workspace — loads from <code>/{slug}/hub</code>.</p>
      </div>
    </div>
  )
}
