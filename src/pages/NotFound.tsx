import { useNavigate } from 'react-router-dom'

export function NotFound() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="text-center space-y-4">
        <p className="text-6xl font-bold text-muted-foreground">404</p>
        <p className="text-muted-foreground">Page not found.</p>
        <button onClick={() => navigate('/')} className="text-sm text-primary hover:underline">Go home</button>
      </div>
    </div>
  )
}
