import { useEffect, useState } from 'react'
import { supabase } from '../../../integrations/supabase/client'
import { Cloud, CloudRain, Snowflake, Zap, Sun } from 'lucide-react'

interface Lead {
  property_lat: number | null
  property_lng: number | null
  preferred_date: string | null
  property_address: string | null
}

interface Forecast {
  precipitation_pct: number
  is_snow: boolean
  is_severe: boolean
  weather_code: number
  description: string
}

interface Props { leadId: string }

export function WeatherTab({ leadId }: Props) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [forecast, setForecast] = useState<Forecast | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    supabase
      .from('leads')
      .select('property_lat, property_lng, preferred_date, property_address')
      .eq('id', leadId)
      .single()
      .then(({ data }) => {
        setLead(data)
        if (data?.property_lat && data?.property_lng && data?.preferred_date) {
          fetchWeather(data.property_lat, data.property_lng, data.preferred_date)
        } else {
          setLoading(false)
        }
      })
  }, [leadId])

  const fetchWeather = async (lat: number, lng: number, date: string) => {
    try {
      const { data, error: fnError } = await supabase.functions.invoke('fetch-weather', {
        body: { lat, lng, target_date: date, type: 'forecast' },
      })
      if (fnError) throw fnError
      setForecast(data)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Weather fetch failed')
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!lead?.property_lat || !lead?.property_lng) {
    return (
      <div className="p-5 text-center text-muted-foreground text-sm py-10">
        No GPS coordinates on this lead. Address autocomplete captures coordinates automatically.
      </div>
    )
  }

  if (!lead.preferred_date) {
    return (
      <div className="p-5 text-center text-muted-foreground text-sm py-10">
        Set a preferred date on the lead to see weather forecast.
      </div>
    )
  }

  if (error) {
    return <div className="p-5 text-destructive text-sm">{error}</div>
  }

  if (!forecast) return null

  const WeatherIcon = forecast.is_severe ? Zap
    : forecast.is_snow ? Snowflake
    : forecast.precipitation_pct >= 50 ? CloudRain
    : forecast.precipitation_pct >= 20 ? Cloud
    : Sun

  const severityColor = forecast.is_severe || forecast.is_snow ? 'text-destructive'
    : forecast.precipitation_pct >= 80 ? 'text-amber-400'
    : forecast.precipitation_pct >= 50 ? 'text-yellow-400'
    : 'text-emerald-400'

  const bgColor = forecast.is_severe || forecast.is_snow ? 'bg-destructive/10 border-destructive/30'
    : forecast.precipitation_pct >= 50 ? 'bg-amber-400/10 border-amber-400/30'
    : 'bg-emerald-400/10 border-emerald-400/30'

  return (
    <div className="p-5 space-y-4">
      <div className="text-xs text-muted-foreground">
        Forecast for <span className="text-foreground font-medium">{lead.preferred_date}</span>
        {lead.property_address && <span> at {lead.property_address}</span>}
      </div>

      <div className={`rounded-2xl border p-5 ${bgColor}`}>
        <div className="flex items-center gap-4">
          <WeatherIcon className={`w-12 h-12 ${severityColor}`} />
          <div>
            <p className={`text-2xl font-bold ${severityColor}`}>{forecast.description}</p>
            <p className="text-sm text-muted-foreground mt-1">
              {forecast.precipitation_pct}% precipitation chance
            </p>
          </div>
        </div>

        {(forecast.is_severe || forecast.is_snow || forecast.precipitation_pct >= 50) && (
          <div className="mt-4 text-sm text-foreground/80 leading-relaxed">
            {forecast.is_severe && '⚠️ Severe weather expected — consider rescheduling and contact customer.'}
            {!forecast.is_severe && forecast.is_snow && '❄️ Snow forecast — confirm job can proceed and check rescheduling options.'}
            {!forecast.is_severe && !forecast.is_snow && forecast.precipitation_pct >= 80 && '🌧️ Heavy rain likely — confirm with customer and prepare accordingly.'}
            {!forecast.is_severe && !forecast.is_snow && forecast.precipitation_pct >= 50 && forecast.precipitation_pct < 80 && '🌦️ Rain possible — confirm job can proceed.'}
          </div>
        )}
      </div>

      <p className="text-xs text-muted-foreground">Source: Open-Meteo · Cached up to 6h</p>
    </div>
  )
}
