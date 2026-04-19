import { useParams } from 'react-router-dom'

export function SettingsPage() {
  const { slug } = useParams<{ slug: string }>()
  return (
    <div className="min-h-screen bg-background text-foreground p-6">
      <h1 className="text-2xl font-bold mb-2">Settings</h1>
      <p className="text-muted-foreground text-sm">Workspace: <code>{slug}</code></p>
    </div>
  )
}
