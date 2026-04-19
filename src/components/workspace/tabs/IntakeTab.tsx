import { useEffect, useState } from 'react'
import { supabase } from '../../../integrations/supabase/client'

interface IntakeRow {
  id: string
  field_key: string
  field_value: string | null
}

interface Props { leadId: string }

export function IntakeTab({ leadId }: Props) {
  const [rows, setRows] = useState<IntakeRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase
      .from('lead_intake_data')
      .select('id, field_key, field_value')
      .eq('lead_id', leadId)
      .order('field_key', { ascending: true })
      .then(({ data }) => { setRows(data ?? []); setLoading(false) })
  }, [leadId])

  if (loading) {
    return (
      <div className="p-5 space-y-2 animate-pulse">
        {[...Array(6)].map((_, i) => <div key={i} className="h-10 bg-secondary rounded-lg" />)}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="p-5 text-center text-muted-foreground text-sm py-10">
        No additional intake data recorded.
      </div>
    )
  }

  const label = (key: string) =>
    key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())

  return (
    <div className="p-5">
      <table className="w-full text-sm">
        <tbody>
          {rows.map(row => (
            <tr key={row.id} className="border-b border-border last:border-0">
              <td className="py-2.5 pr-4 text-muted-foreground font-medium w-2/5">{label(row.field_key)}</td>
              <td className="py-2.5 text-foreground">{row.field_value ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
