import { AddressAutocomplete } from './AddressAutocomplete'

export interface FieldDef {
  field_key: string
  field_label: string
  field_type: string
  required?: boolean
  placeholder?: string
  options_json?: string[] | Record<string, string> | null
}

interface DynamicFieldProps {
  field: FieldDef
  value: string
  onChange: (key: string, value: string) => void
  primaryColor?: string
}

export function DynamicField({ field, value, onChange, primaryColor = '#F5C542' }: DynamicFieldProps) {
  const baseInput = `w-full bg-white/5 border border-white/20 rounded-lg px-3 py-2 text-sm text-white placeholder:text-white/40 focus:outline-none focus:ring-2`
  const focusRing = `focus:ring-[${primaryColor}]`

  const options: string[] = Array.isArray(field.options_json)
    ? field.options_json
    : field.options_json && typeof field.options_json === 'object'
    ? Object.values(field.options_json as Record<string, string>)
    : []

  switch (field.field_type) {
    case 'textarea':
      return (
        <textarea
          rows={3}
          className={`${baseInput} ${focusRing} resize-none`}
          placeholder={field.placeholder ?? ''}
          value={value}
          onChange={e => onChange(field.field_key, e.target.value)}
          required={field.required}
        />
      )

    case 'select':
      return (
        <select
          className={`${baseInput} ${focusRing}`}
          value={value}
          onChange={e => onChange(field.field_key, e.target.value)}
          required={field.required}
        >
          <option value="">Select…</option>
          {options.map(opt => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      )

    case 'boolean':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 accent-[--color-primary]"
            checked={value === 'true'}
            onChange={e => onChange(field.field_key, e.target.checked ? 'true' : 'false')}
          />
          <span className="text-sm text-white/70">{field.field_label}</span>
        </label>
      )

    case 'date':
      return (
        <input
          type="date"
          className={`${baseInput} ${focusRing}`}
          value={value}
          min={new Date().toISOString().split('T')[0]}
          onChange={e => onChange(field.field_key, e.target.value)}
          required={field.required}
        />
      )

    case 'number':
      return (
        <input
          type="number"
          className={`${baseInput} ${focusRing}`}
          placeholder={field.placeholder ?? ''}
          value={value}
          onChange={e => onChange(field.field_key, e.target.value)}
          required={field.required}
        />
      )

    case 'tel':
      return (
        <input
          type="tel"
          className={`${baseInput} ${focusRing}`}
          placeholder={field.placeholder ?? '(555) 000-0000'}
          value={value}
          onChange={e => onChange(field.field_key, e.target.value)}
          required={field.required}
        />
      )

    case 'email':
      return (
        <input
          type="email"
          className={`${baseInput} ${focusRing}`}
          placeholder={field.placeholder ?? 'you@example.com'}
          value={value}
          onChange={e => onChange(field.field_key, e.target.value)}
          required={field.required}
        />
      )

    case 'address':
      return (
        <AddressAutocomplete
          value={value}
          placeholder={field.placeholder ?? '123 Main St'}
          required={field.required}
          onChange={(addr, lat, lng) => {
            onChange(field.field_key, addr)
            if (lat !== undefined) onChange('property_lat', String(lat))
            if (lng !== undefined) onChange('property_lng', String(lng))
          }}
        />
      )

    default:
      return (
        <input
          type="text"
          className={`${baseInput} ${focusRing}`}
          placeholder={field.placeholder ?? ''}
          value={value}
          onChange={e => onChange(field.field_key, e.target.value)}
          required={field.required}
        />
      )
  }
}

export function FieldGroup({ field, value, onChange, primaryColor }: DynamicFieldProps) {
  if (field.field_type === 'boolean') {
    return (
      <div className="py-1">
        <DynamicField field={field} value={value} onChange={onChange} primaryColor={primaryColor} />
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-1">
      <label className="text-sm font-medium text-white/80">
        {field.field_label}
        {field.required && <span className="text-red-400 ml-1">*</span>}
      </label>
      <DynamicField field={field} value={value} onChange={onChange} primaryColor={primaryColor} />
    </div>
  )
}
