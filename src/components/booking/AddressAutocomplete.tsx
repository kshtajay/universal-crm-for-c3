import { useState, useRef, useEffect } from 'react'
import { MapPin } from 'lucide-react'

const RADAR_KEY = import.meta.env.VITE_RADAR_PUBLISHABLE_KEY

interface Suggestion {
  formattedAddress: string
  latitude: number
  longitude: number
}

interface Props {
  value: string
  onChange: (address: string, lat?: number, lng?: number) => void
  placeholder?: string
  required?: boolean
}

export function AddressAutocomplete({ value, onChange, placeholder = '123 Main St, City, State', required }: Props) {
  const [query, setQuery] = useState(value)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const wrapperRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setQuery(value)
  }, [value])

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const search = async (q: string) => {
    if (!q || q.length < 3) { setSuggestions([]); return }
    if (!RADAR_KEY) {
      // No Radar key — just pass through the typed value
      onChange(q)
      return
    }

    try {
      const res = await fetch(
        `https://api.radar.io/v1/search/autocomplete?query=${encodeURIComponent(q)}&limit=5&layers=address`,
        { headers: { Authorization: RADAR_KEY } }
      )
      if (!res.ok) return
      const data = await res.json()
      setSuggestions(data.addresses ?? [])
      setOpen(true)
    } catch {
      // Silently fail — user can still type manually
    }
  }

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value
    setQuery(val)
    onChange(val)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => search(val), 300)
  }

  const handleSelect = (s: Suggestion) => {
    setQuery(s.formattedAddress)
    setSuggestions([])
    setOpen(false)
    onChange(s.formattedAddress, s.latitude, s.longitude)
  }

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/40 pointer-events-none" />
        <input
          type="text"
          className="w-full bg-white/5 border border-white/20 rounded-lg pl-9 pr-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2 focus:ring-[#F5C542]"
          placeholder={placeholder}
          value={query}
          onChange={handleInput}
          required={required}
          autoComplete="off"
        />
      </div>

      {open && suggestions.length > 0 && (
        <ul className="absolute z-50 top-full mt-1 w-full bg-[#0A1628] border border-white/20 rounded-xl shadow-xl overflow-hidden">
          {suggestions.map((s, i) => (
            <li
              key={i}
              className="flex items-center gap-2 px-3 py-2.5 text-sm text-white hover:bg-white/10 cursor-pointer"
              onMouseDown={() => handleSelect(s)}
            >
              <MapPin className="w-3.5 h-3.5 text-white/40 shrink-0" />
              {s.formattedAddress}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
