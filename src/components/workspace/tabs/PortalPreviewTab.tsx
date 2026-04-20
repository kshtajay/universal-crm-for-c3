import { useState, useEffect } from 'react'
import { Copy, Send, ExternalLink, Globe } from 'lucide-react'
import { supabase } from '../../../integrations/supabase/client'

interface Lead {
  portal_token: string | null
  full_name: string | null
  email: string | null
}

interface Props {
  leadId: string
  clientId: string
}

export function PortalPreviewTab({ leadId, clientId }: Props) {
  const [lead, setLead] = useState<Lead | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [sending, setSending] = useState(false)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    supabase
      .from('leads')
      .select('portal_token, full_name, email')
      .eq('id', leadId)
      .single()
      .then(({ data }) => {
        setLead(data as Lead)
        setLoading(false)
      })
  }, [leadId])

  const portalUrl = lead?.portal_token
    ? `${window.location.origin}/portal/${lead.portal_token}`
    : null

  const generateToken = async () => {
    setGenerating(true)
    const token = crypto.randomUUID()
    await supabase.from('leads').update({ portal_token: token }).eq('id', leadId)
    setLead(prev => prev ? { ...prev, portal_token: token } : prev)
    setGenerating(false)
  }

  const copyUrl = () => {
    if (!portalUrl) return
    navigator.clipboard.writeText(portalUrl)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const sendInvite = async () => {
    if (!portalUrl || !lead?.email) return
    setSending(true)
    await supabase.functions.invoke('send-client-email', {
      body: {
        lead_id: leadId,
        client_id: clientId,
        template_key: 'portal_invite',
        to_field: lead.email,
      },
    })
    setSending(false)
  }

  if (loading) return (
    <div className="p-5 space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-secondary rounded-lg" />)}
    </div>
  )

  return (
    <div className="p-5 space-y-5">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
          <Globe className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="text-sm font-semibold">Customer Portal</p>
          <p className="text-xs text-muted-foreground">Share a branded portal link with {lead?.full_name ?? 'the client'}</p>
        </div>
      </div>

      {portalUrl ? (
        <div className="space-y-3">
          {/* URL display */}
          <div className="bg-secondary rounded-lg p-3 flex items-center gap-2">
            <code className="flex-1 text-xs text-muted-foreground truncate">{portalUrl}</code>
            <button
              onClick={copyUrl}
              className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                copied ? 'bg-green-500/20 text-green-400' : 'bg-card hover:bg-accent text-foreground'
              }`}
            >
              <Copy className="w-3.5 h-3.5" />
              {copied ? 'Copied!' : 'Copy'}
            </button>
            <a
              href={portalUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-medium bg-card hover:bg-accent transition-colors"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Preview
            </a>
          </div>

          {/* Send invite */}
          {lead?.email ? (
            <button
              onClick={sendInvite}
              disabled={sending}
              className="w-full flex items-center justify-center gap-2 py-2.5 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40"
            >
              <Send className="w-4 h-4" />
              {sending ? 'Sending Invite…' : `Send Portal Invite to ${lead.email}`}
            </button>
          ) : (
            <p className="text-xs text-muted-foreground text-center">Add an email to the lead to send a portal invite.</p>
          )}

          {/* What the portal shows */}
          <div className="bg-secondary rounded-xl p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-3">Portal Shows</p>
            <ul className="space-y-1.5 text-sm text-muted-foreground">
              {[
                'Project stage and status',
                'Estimate total (contractor amount)',
                'Unpaid invoices with Pay Now link',
                'Paid invoice confirmations',
                'Open tasks as Next Steps',
              ].map(item => (
                <li key={item} className="flex items-center gap-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center py-8 gap-4">
          <p className="text-muted-foreground text-sm text-center">No portal link yet. Generate one to share with this client.</p>
          <button
            onClick={generateToken}
            disabled={generating}
            className="px-5 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:opacity-90 disabled:opacity-40"
          >
            {generating ? 'Generating…' : 'Generate Portal Link'}
          </button>
        </div>
      )}
    </div>
  )
}
