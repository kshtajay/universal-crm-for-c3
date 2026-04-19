import { useParams } from 'react-router-dom'

export function ConsultationPaymentPage() {
  const { slug } = useParams<{ slug: string }>()
  return (
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center p-6">
      <div className="max-w-sm w-full text-center space-y-4">
        <h1 className="text-2xl font-bold">Consultation Fee</h1>
        <p className="text-muted-foreground text-sm">Client: <code>{slug}</code></p>
        <p className="text-muted-foreground text-sm">Stripe payment — fee amount loads from <code>deposit_rules</code>.</p>
      </div>
    </div>
  )
}
