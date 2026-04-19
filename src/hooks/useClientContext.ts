import { useState, useEffect } from 'react'
import { supabase } from '../integrations/supabase/client'

interface ClientContext {
  clientId: string | null
  contractorType: string | null
  companyName: string | null
  loading: boolean
}

const cache = new Map<string, ClientContext>()

export function useClientContext(slug: string | undefined): ClientContext {
  const [ctx, setCtx] = useState<ClientContext>({
    clientId: null,
    contractorType: null,
    companyName: null,
    loading: true,
  })

  useEffect(() => {
    if (!slug) return
    if (cache.has(slug)) {
      setCtx({ ...cache.get(slug)!, loading: false })
      return
    }

    supabase
      .from('clients')
      .select('id, company_name, contractor_types(key)')
      .eq('slug', slug)
      .single()
      .then(({ data }) => {
        const result: ClientContext = {
          clientId: data?.id ?? null,
          contractorType: (data?.contractor_types as any)?.key ?? null,
          companyName: data?.company_name ?? null,
          loading: false,
        }
        cache.set(slug, result)
        setCtx(result)
      })
  }, [slug])

  return ctx
}
