import { useState, useEffect, FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { FieldGroup, FieldDef } from '../components/booking/DynamicField'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

interface FieldDefWithSection extends FieldDef {
  section?: string
  visible_for_types?: string[]
  maps_to_leads_column?: string
}

interface BrandConfig {
  brand_name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  tagline: string | null
}

interface BookingConfig {
  client: { id: string; company_name: string; contractor_type: string | null }
  brand: BrandConfig
  fields: FieldDefWithSection[]
  deposit_rules: { consultation_fee: number; show_consultation_banner: boolean } | null
}

async function edgeFn(name: string, body: unknown) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/${name}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(await res.text())
  return res.json()
}

export function BookingPage() {
  const { slug } = useParams<{ slug: string }>()
  const [config, setConfig] = useState<BookingConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [step, setStep] = useState<'who_where' | 'what_when' | 'notes'>('who_where')

  useEffect(() => {
    if (!slug) return
    edgeFn('get-booking-config', { slug, type: 'booking' })
      .then(data => { setConfig(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [slug])

  const handleChange = (key: string, val: string) => setValues(v => ({ ...v, [key]: val }))

  const fieldsBySection = (section: string) =>
    (config?.fields ?? []).filter((f: FieldDefWithSection) => (f.section ?? 'who_where') === section)

  const currentFields = fieldsBySection(step)

  const handleNext = (e: FormEvent) => {
    e.preventDefault()
    if (step === 'who_where') setStep('what_when')
    else if (step === 'what_when') setStep('notes')
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!config || !slug) return
    setSubmitting(true)
    try {
      await edgeFn('submit-booking', { slug, fields: values, source: 'booking_page' })
      setSubmitted(true)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Submission failed')
    } finally {
      setSubmitting(false)
    }
  }

  const primaryColor = config?.brand.primary_color ?? '#F5C542'

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center">
        <div className="w-8 h-8 border-2 border-[#F5C542] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (error && !config) {
    return (
      <div className="min-h-screen bg-[#0A1628] flex items-center justify-center p-6">
        <div className="text-center">
          <p className="text-red-400 mb-2">Unable to load booking page</p>
          <p className="text-white/40 text-sm">{error}</p>
        </div>
      </div>
    )
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6" style={{ backgroundColor: config?.brand.secondary_color ?? '#0A1628' }}>
        <div className="max-w-md w-full text-center space-y-4">
          <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto text-3xl" style={{ backgroundColor: primaryColor }}>
            ✓
          </div>
          <h1 className="text-2xl font-bold text-white">You're booked!</h1>
          <p className="text-white/60">
            We received your request and will be in touch shortly.
          </p>
          {config?.brand.tagline && (
            <p className="text-white/40 text-sm italic">{config.brand.tagline}</p>
          )}
        </div>
      </div>
    )
  }

  const steps = ['who_where', 'what_when', 'notes'] as const
  const stepIndex = steps.indexOf(step)
  const stepLabels = ['Your Info', 'Project Details', 'Notes']
  const isLastStep = step === 'notes' || fieldsBySection('notes').length === 0

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: config?.brand.secondary_color ?? '#0A1628' }}>
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          {config?.brand.logo_url && (
            <img src={config.brand.logo_url} alt={config.brand.brand_name} className="h-12 mx-auto object-contain" />
          )}
          <h1 className="text-2xl font-bold text-white">{config?.brand.brand_name}</h1>
          {config?.brand.tagline && <p className="text-white/50 text-sm">{config.brand.tagline}</p>}
        </div>

        {/* Consultation fee banner */}
        {config?.deposit_rules?.show_consultation_banner && config.deposit_rules.consultation_fee > 0 && (
          <div className="rounded-xl p-3 text-center text-sm font-medium text-black" style={{ backgroundColor: primaryColor }}>
            ${config.deposit_rules.consultation_fee} consultation fee collected at booking
          </div>
        )}

        {/* Step progress */}
        <div className="flex gap-2">
          {steps.map((s, i) => (
            <div key={s} className={`h-1 flex-1 rounded-full transition-colors ${i <= stepIndex ? '' : 'bg-white/10'}`}
              style={{ backgroundColor: i <= stepIndex ? primaryColor : undefined }} />
          ))}
        </div>
        <p className="text-white/40 text-sm">{stepLabels[stepIndex]}</p>

        {/* Form */}
        <form onSubmit={isLastStep ? handleSubmit : handleNext} className="bg-white/5 backdrop-blur rounded-2xl p-6 space-y-4 border border-white/10">
          {currentFields.length === 0 ? (
            <p className="text-white/40 text-sm text-center">No fields for this step.</p>
          ) : (
            currentFields.map(field => (
              <FieldGroup
                key={field.field_key}
                field={field}
                value={values[field.field_key] ?? ''}
                onChange={handleChange}
                primaryColor={primaryColor}
              />
            ))
          )}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50"
            style={{ backgroundColor: primaryColor, color: '#1A1A1A' }}
          >
            {submitting ? 'Submitting…' : isLastStep ? 'Request Service' : 'Continue →'}
          </button>
        </form>
      </div>
    </div>
  )
}
