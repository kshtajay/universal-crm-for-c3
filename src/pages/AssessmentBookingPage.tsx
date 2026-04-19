import { useParams } from 'react-router-dom'

export function AssessmentBookingPage() {
  const { slug } = useParams<{ slug: string }>()
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-lg w-full">
        <h1 className="text-2xl font-bold mb-2">Book a Site Assessment</h1>
        <p className="text-muted-foreground text-sm mb-6">Client: <code>{slug}</code></p>
        <p className="text-muted-foreground text-sm">Form fields load from <code>assessment_fields</code> table.</p>
      </div>
    </div>
  )
}
