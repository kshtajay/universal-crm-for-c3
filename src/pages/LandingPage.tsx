import { useNavigate } from 'react-router-dom'

export function LandingPage() {
  const navigate = useNavigate()
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="text-center space-y-6 max-w-lg">
        <h1 className="text-4xl font-bold">Contractors Command Center</h1>
        <p className="text-muted-foreground">The all-in-one CRM for home service contractors.</p>
        <button
          onClick={() => navigate('/login')}
          className="px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-xl"
        >
          Sign In
        </button>
      </div>
    </div>
  )
}
