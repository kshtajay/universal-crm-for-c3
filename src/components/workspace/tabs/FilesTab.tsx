import { useState, useEffect, useRef } from 'react'
import { Upload, FileText, Image, Trash2, FolderOpen } from 'lucide-react'
import { supabase } from '../../../integrations/supabase/client'

interface JobFile {
  id: string
  file_name: string
  file_url: string
  phase: string
  file_type: string
  created_at: string
}

interface Props {
  leadId: string
  clientId: string
}

const PHASES = ['pre_job', 'during', 'post_job', 'permits', 'contracts', 'other']

const PHASE_LABELS: Record<string, string> = {
  pre_job: 'Pre-Job',
  during: 'During Job',
  post_job: 'Post-Job',
  permits: 'Permits',
  contracts: 'Contracts',
  other: 'Other',
}

export function FilesTab({ leadId, clientId }: Props) {
  const [files, setFiles] = useState<JobFile[]>([])
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [phase, setPhase] = useState('pre_job')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    supabase
      .from('job_files')
      .select('id, file_name, file_url, phase, file_type, created_at')
      .eq('lead_id', leadId)
      .order('created_at', { ascending: false })
      .then(({ data }) => {
        setFiles((data ?? []) as JobFile[])
        setLoading(false)
      })
  }, [leadId])

  const upload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const path = `leads/${leadId}/${phase}/${Date.now()}_${file.name}`
    await supabase.storage.from('job-files').upload(path, file)
    const { data: { publicUrl } } = supabase.storage.from('job-files').getPublicUrl(path)
    const { data } = await supabase
      .from('job_files')
      .insert({
        lead_id: leadId,
        client_id: clientId,
        file_name: file.name,
        file_url: publicUrl,
        phase,
        file_type: file.type,
      })
      .select('id, file_name, file_url, phase, file_type, created_at')
      .single()
    if (data) setFiles(prev => [data as JobFile, ...prev])
    if (fileInputRef.current) fileInputRef.current.value = ''
    setUploading(false)
  }

  const remove = async (id: string, fileUrl: string) => {
    await supabase.from('job_files').delete().eq('id', id)
    const path = fileUrl.split('/job-files/')[1]
    if (path) await supabase.storage.from('job-files').remove([path])
    setFiles(prev => prev.filter(f => f.id !== id))
  }

  const grouped = PHASES.reduce<Record<string, JobFile[]>>((acc, p) => {
    acc[p] = files.filter(f => f.phase === p)
    return acc
  }, {})

  if (loading) return (
    <div className="p-5 space-y-3 animate-pulse">
      {[...Array(3)].map((_, i) => <div key={i} className="h-12 bg-secondary rounded-lg" />)}
    </div>
  )

  return (
    <div className="p-5 space-y-5">
      {/* Upload bar */}
      <div className="flex gap-2 items-center">
        <select
          className="flex-1 bg-secondary border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
          value={phase}
          onChange={e => setPhase(e.target.value)}
        >
          {PHASES.map(p => <option key={p} value={p}>{PHASE_LABELS[p]}</option>)}
        </select>
        <input ref={fileInputRef} type="file" className="hidden" onChange={upload} />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="flex items-center gap-1.5 px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:opacity-90 disabled:opacity-40"
        >
          <Upload className="w-3.5 h-3.5" />
          {uploading ? 'Uploading…' : 'Upload'}
        </button>
      </div>

      {/* File groups */}
      {files.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 gap-3">
          <FolderOpen className="w-10 h-10 text-muted-foreground" />
          <p className="text-muted-foreground text-sm">No files uploaded yet</p>
        </div>
      ) : (
        PHASES.filter(p => grouped[p].length > 0).map(p => (
          <div key={p}>
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">{PHASE_LABELS[p]}</p>
            <div className="space-y-1.5">
              {grouped[p].map(f => (
                <div key={f.id} className="flex items-center gap-2 px-3 py-2 bg-secondary rounded-lg">
                  {f.file_type.startsWith('image/') ? (
                    <Image className="w-4 h-4 text-primary shrink-0" />
                  ) : (
                    <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                  )}
                  <a
                    href={f.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 text-sm truncate hover:text-primary transition-colors"
                  >
                    {f.file_name}
                  </a>
                  <span className="text-xs text-muted-foreground shrink-0">
                    {new Date(f.created_at).toLocaleDateString()}
                  </span>
                  <button
                    onClick={() => remove(f.id, f.file_url)}
                    className="text-muted-foreground hover:text-destructive ml-1 shrink-0"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  )
}
