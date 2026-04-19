import { useState, useEffect, FormEvent } from 'react'
import { useParams } from 'react-router-dom'
import { FieldGroup, FieldDef } from '../components/booking/DynamicField'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY

interface BrandConfig {
  brand_name: string
  logo_url: string | null
  primary_color: string
  secondary_color: string
  tagline: string | null
}

interface AssessmentConfig {
  client: { id: string; company_name: string }
  brand: BrandConfig
  fields: FieldDef[]
  deposit_rules: { assessment_fee: number } | null
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

export function AssessmentBookingPage() {
  const { slug } = useParams<{ slug: string }>()
  const [config, setConfig] = useState<AssessmentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [values, setValues] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)

  useEffect(() => {
    if (!slug) return
    edgeFn('get-booking-config', { slug, type: 'assessment' })
      .then(data => { setConfig(data); setLoading(false) })
      .catch(err => { setError(err.message); setLoading(false) })
  }, [slug])

  const handleChange = (key: string, val: string) => setValues(v => ({ ...v, [key]: val }))

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    if (!config || !slug) return
    setSubmitting(true)
    try {
      await edgeFn('submit-booking', { slug, fields: values, source: 'assessment_page' })
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
          <p className="text-red-400 mb-2">Unable to load this page</p>
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
          <h1 className="text-2xl font-bold text-white">Assessment Requested!</h1>
          <p className="text-white/60">
            We'll reach out to schedule your on-site assessment.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-8 px-4" style={{ backgroundColor: config?.brand.secondary_color ?? '#0A1628' }}>
      <div className="max-w-lg mx-auto space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          {config?.brand.logo_url && (
            <img src={config.brand.logo_url} alt={config.brand.brand_name} className="h-12 mx-auto object-contain" />
          )}
          <h1 className="text-2xl font-bold text-white">{config?.brand.brand_name}</h1>
          <p className="text-white/50 text-sm">Book a Free Site Assessment</p>
          {config?.brand.tagline && <p className="text-white/40 text-xs">{config.brand.tagline}</p>}
        </div>

        {/* Assessment fee notice */}
        {config?.deposit_rules?.assessment_fee && config.deposit_rules.assessment_fee > 0 && (
          <div className="rounded-xl p-3 text-center text-sm font-medium text-black" style={{ backgroundColor: primaryColor }}>
            ${config.deposit_rules.assessment_fee} assessment fee applies
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="bg-white/5 backdrop-blur rounded-2xl p-6 space-y-4 border border-white/10">
          {(config?.fields ?? []).map(field => (
            <FieldGroup
              key={field.field_key}
              field={field}
              value={values[field.field_key] ?? ''}
              onChange={handleChange}
              primaryColor={primaryColor}
            />
          ))}

          {error && <p className="text-red-400 text-sm">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-3 rounded-xl font-semibold text-sm transition-opacity disabled:opacity-50"
            style={{ backgroundColor: primaryColor, color: '#1A1A1A' }}
          >
            {submitting ? 'Submitting…' : 'Request Assessment'}
          </button>
        </form>
      </div>
    </div>
  )
}
