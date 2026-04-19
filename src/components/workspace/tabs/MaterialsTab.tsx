import { useState, useEffect } from 'react'
import { Search, Plus, Package } from 'lucide-react'
import { supabase } from '../../../integrations/supabase/client'

interface Product {
  id: string
  name: string
  unit: string
  price: number | null
  source: 'local' | 'lowes'
}

interface JobCost {
  id: string
  description: string | null
  cost_type: string | null
  amount: number
  created_at: string
}

interface Props {
  leadId: string
  clientId: string
}

export function MaterialsTab({ leadId, clientId }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Product[]>([])
  const [searching, setSearching] = useState(false)
  const [jobCosts, setJobCosts] = useState<JobCost[]>([])
  const [adding, setAdding] = useState<string | null>(null)

  const loadJobCosts = () => {
    supabase
      .from('job_costs')
      .select('id, description, cost_type, amount, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .then(({ data }) => setJobCosts(data ?? []))
  }

  useEffect(() => { loadJobCosts() }, [leadId])

  const handleSearch = async () => {
    if (!query.trim()) return
    setSearching(true)
    try {
      const { data, error } = await supabase.functions.invoke('search-retailer-products', {
        body: { query, client_id: clientId, limit: 15 },
      })
      if (error) throw error
      setResults(data.results ?? [])
    } catch (err) {
      console.error('Product search failed:', err)
    } finally {
      setSearching(false)
    }
  }

  const addToJob = async (product: Product) => {
    setAdding(product.id)
    try {
      const { data } = await supabase
        .from('job_costs')
        .insert({
          lead_id: leadId,
          client_id: clientId,
          description: product.name,
          cost_type: 'material',
          amount: product.price ?? 0,
        })
        .select('id, description, cost_type, amount, created_at')
        .single()

      if (data) setJobCosts(prev => [data, ...prev])
    } finally {
      setAdding(null)
    }
  }

  const total = jobCosts.reduce((sum, c) => sum + Number(c.amount), 0)

  return (
    <div className="p-5 space-y-5">
      {/* Search */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            className="w-full bg-secondary border border-border rounded-lg pl-9 pr-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            placeholder="Search materials (e.g. drywall, PVC pipe…)"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={searching || !query.trim()}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium disabled:opacity-40 hover:opacity-90 transition-opacity"
        >
          {searching ? '…' : 'Search'}
        </button>
      </div>

      {/* Search results */}
      {results.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Results</p>
          {results.map(product => (
            <div key={product.id} className="flex items-center gap-3 p-2.5 rounded-lg bg-secondary hover:bg-accent transition-colors">
              <Package className="w-4 h-4 text-muted-foreground shrink-0" />
              <div className="flex-1 min-w-0">
                <p className="text-sm text-foreground truncate">{product.name}</p>
                <div className="flex items-center gap-2 mt-0.5">
                  {product.price !== null && (
                    <span className="text-xs text-primary font-medium">
                      ${product.price.toFixed(2)} / {product.unit}
                    </span>
                  )}
                  <span className={`text-xs px-1.5 py-0.5 rounded-full ${
                    product.source === 'local'
                      ? 'bg-emerald-500/20 text-emerald-400'
                      : 'bg-blue-500/20 text-blue-400'
                  }`}>
                    {product.source === 'local' ? 'Catalog' : "Lowe's"}
                  </span>
                </div>
              </div>
              <button
                onClick={() => addToJob(product)}
                disabled={adding === product.id}
                className="flex items-center gap-1 px-2.5 py-1.5 bg-primary/20 text-primary rounded-lg text-xs font-medium hover:bg-primary/30 transition-colors disabled:opacity-40"
              >
                <Plus className="w-3 h-3" />
                Add
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Job costs */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground font-medium uppercase tracking-wide">Job Costs</p>
          {jobCosts.length > 0 && (
            <span className="text-sm font-semibold text-primary">${total.toFixed(2)}</span>
          )}
        </div>

        {jobCosts.length === 0 ? (
          <p className="text-muted-foreground text-sm text-center py-6">No costs added yet.</p>
        ) : (
          jobCosts.map(cost => (
            <div key={cost.id} className="flex items-center justify-between p-2.5 rounded-lg bg-secondary">
              <div className="min-w-0">
                <p className="text-sm text-foreground truncate">{cost.description ?? 'Unnamed cost'}</p>
                {cost.cost_type && (
                  <p className="text-xs text-muted-foreground capitalize">{cost.cost_type}</p>
                )}
              </div>
              <span className="text-sm font-medium text-foreground ml-3 shrink-0">
                ${Number(cost.amount).toFixed(2)}
              </span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
