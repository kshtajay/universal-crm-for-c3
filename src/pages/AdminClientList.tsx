import { useNavigate } from 'react-router-dom'

export function AdminClientList() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/admin')} className="text-sm text-muted-foreground hover:text-foreground">← Admin</button>
        <h1 className="text-2xl font-bold">Clients</h1>
        <button className="ml-auto px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold">+ New Client</button>
      </div>
      <p className="text-muted-foreground text-sm">Client list — loads from <code>clients</code> table.</p>
    </div>
  )
}
