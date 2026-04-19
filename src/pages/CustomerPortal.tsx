import { useParams } from 'react-router-dom'

export function CustomerPortal() {
  const { token } = useParams<{ token: string }>()
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-2xl w-full">
        <h1 className="text-2xl font-bold mb-2">Your Project Portal</h1>
        <p className="text-muted-foreground text-sm mb-6 font-mono">Token: {token}</p>
        <p className="text-muted-foreground text-sm">Tabs: Overview · Estimate · Shopping List · Contract · Payments · Photos</p>
      </div>
    </div>
  )
}
