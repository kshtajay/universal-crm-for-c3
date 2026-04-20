import { useState, useEffect, useRef } from 'react'
import { FileSignature, Download, Send } from 'lucide-react'
import { supabase } from '../../../integrations/supabase/client'

interface Contract {
  id: string
  terms_text: string
  status: string
  signed_at: string | null
  signature_image_url: string | null
}

interface Props {
  leadId: string
  clientId: string
}

export function ContractTab({ leadId, clientId }: Props) {
  const [contract, setContract] = useState<Contract | null>(null)
  const [terms, setTerms] = useState('')
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [sending, setSending] = useState(false)
  const [drawing, setDrawing] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const lastPos = useRef<{ x: number; y: number } | null>(null)

  useEffect(() => {
    supabase
      .from('contracts')
      .select('id, terms_text, status, signed_at, signature_image_url')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single()
      .then(({ data }) => {
        if (data) {
          setContract(data)
          setTerms(data.terms_text ?? '')
        }
        setLoading(false)
      })
  }, [leadId])

  const createContract = async () => {
    setSaving(true)
    const { data } = await supabase
      .from('contracts')
      .insert({ lead_id: leadId, client_id: clientId, terms_text: terms, status: 'draft' })
      .select('id, terms_text, status, signed_at, signature_image_url')
      .single()
    if (data) setContract(data)
    setSaving(false)
  }

  const saveTerms = async () => {
    if (!contract) return
    setSaving(true)
    await supabase.from('contracts').update({ terms_text: terms }).eq('id', contract.id)
    setContract(prev => prev ? { ...prev, terms_text: terms } : prev)
    setSaving(false)
  }

  const sendContract = async () => {
    if (!contract) return
    setSending(true)
    await supabase.from('contracts').update({ status: 'sent' }).eq('id', contract.id)
    setContract(prev => prev ? { ...prev, status: 'sent' } : prev)
    await supabase.functions.invoke('run-automation', {
      body: { event_type: 'stage_change', lead_id: leadId, client_id: clientId, payload: { new_stage: 'contract_sent' } },
    })
    setSending(false)
  }

  // Canvas drawing helpers
  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top }
    }
    return { x: (e as React.MouseEvent).clientX - rect.left, y: (e as React.MouseEvent).clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    setDrawing(true)
    lastPos.current = getPos(e, canvas)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!drawing) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(lastPos.current!.x, lastPos.current!.y)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#F5C542'
    ctx.lineWidth = 2
    ctx.lineCap = 'round'
    ctx.stroke()
    lastPos.current = pos
  }

  const stopDraw = () => setDrawing(false)

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }

  const saveSignature = async () => {
    const canvas = canvasRef.current
    if (!canvas || !contract) return
    setSaving(true)
    const dataUrl = canvas.toDataURL('image/png')
    const blob = await (await fetch(dataUrl)).blob()
    const path = `contracts/${contract.id}/signature.png`
    await supabase.storage.from('job-files').upload(path, blob, { upsert: true })
    const { data: { publicUrl } } = supabase.storage.from('job-files').getPublicUrl(path)
    const now = new Date().toISOString()
    await supabase.from('contracts').update({ status: 'signed', signed_at: now, signature_image_url: publicUrl }).eq('id', contract.id)
    setContract(prev => prev ? { ...prev, status: 'signed', signed_at: now, signature_image_url: publicUrl } : prev)
    setSaving(false)
  }

  if (loading) return (
    <div className="p-5 space-y-3 animate-pulse">
      {[...Array(4)].map((_, i) => <div key={i} className="h-10 bg-secondary rounded-lg" />)}
    </div>
  )

  if (!contract) return (
    <div className="p-5 flex flex-col items-center justify-center py-16 gap-4">
      <FileSignature className="w-10 h-10 text-muted-foreground" />
      <p className="text-muted-foreground text-sm">No contract yet</p>
      <textarea
        className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[120px] resize-none"
        placeholder="Enter contract terms..."
        value={terms}
        onChange={e => setTerms(e.target.value)}
      />
      <button
        onClick={createContract}
        disabled={saving || !terms.trim()}
        className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 transition-opacity disabled:opacity-40"
      >
        {saving ? 'Creating…' : 'Create Contract'}
      </button>
    </div>
  )

  return (
    <div className="p-5 space-y-5">
      {/* Status bar */}
      <div className="flex items-center justify-between">
        <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${
          contract.status === 'signed' ? 'bg-green-500/20 text-green-400'
          : contract.status === 'sent' ? 'bg-blue-500/20 text-blue-400'
          : 'bg-secondary text-muted-foreground'
        }`}>
          {contract.status}
        </span>
        <div className="flex gap-2">
          {contract.status === 'draft' && (
            <button
              onClick={sendContract}
              disabled={sending}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
            >
              <Send className="w-3.5 h-3.5" />
              {sending ? 'Sending…' : 'Send'}
            </button>
          )}
          <button
            onClick={() => supabase.functions.invoke('generate-contract-pdf', { body: { contract_id: contract.id } })}
            className="flex items-center gap-1.5 px-3 py-1.5 border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            PDF
          </button>
        </div>
      </div>

      {/* Terms */}
      <div>
        <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Contract Terms</p>
        {contract.status === 'draft' ? (
          <div className="space-y-2">
            <textarea
              className="w-full bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary min-h-[160px] resize-none"
              value={terms}
              onChange={e => setTerms(e.target.value)}
            />
            <button
              onClick={saveTerms}
              disabled={saving}
              className="px-4 py-1.5 bg-secondary border border-border rounded-lg text-sm font-medium hover:bg-accent transition-colors disabled:opacity-40"
            >
              {saving ? 'Saving…' : 'Save Terms'}
            </button>
          </div>
        ) : (
          <div className="bg-secondary rounded-lg p-3 text-sm whitespace-pre-wrap leading-relaxed">
            {contract.terms_text}
          </div>
        )}
      </div>

      {/* Signature section */}
      {contract.status === 'sent' && (
        <div>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">Client Signature</p>
          <div className="bg-secondary rounded-xl p-4 space-y-3">
            <canvas
              ref={canvasRef}
              width={560}
              height={140}
              className="w-full rounded-lg bg-card border border-border cursor-crosshair touch-none"
              onMouseDown={startDraw}
              onMouseMove={draw}
              onMouseUp={stopDraw}
              onMouseLeave={stopDraw}
              onTouchStart={startDraw}
              onTouchMove={draw}
              onTouchEnd={stopDraw}
            />
            <div className="flex gap-2 justify-end">
              <button onClick={clearCanvas} className="px-3 py-1.5 border border-border rounded-lg text-sm hover:bg-accent transition-colors">
                Clear
              </button>
              <button
                onClick={saveSignature}
                disabled={saving}
                className="px-4 py-1.5 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
              >
                {saving ? 'Saving…' : 'Save Signature'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Signed confirmation */}
      {contract.status === 'signed' && (
        <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 space-y-2">
          <p className="text-sm font-semibold text-green-400">Contract Signed</p>
          {contract.signed_at && (
            <p className="text-xs text-muted-foreground">
              {new Date(contract.signed_at).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}
            </p>
          )}
          {contract.signature_image_url && (
            <img src={contract.signature_image_url} alt="Signature" className="max-h-20 border border-border rounded-lg bg-card p-2" />
          )}
        </div>
      )}
    </div>
  )
}
