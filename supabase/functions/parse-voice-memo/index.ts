import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27?target=deno'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

// Supported audio MIME types for Claude
const AUDIO_MIME_TYPES: Record<string, string> = {
  mp3: 'audio/mpeg',
  mp4: 'audio/mp4',
  m4a: 'audio/mp4',
  wav: 'audio/wav',
  webm: 'audio/webm',
  ogg: 'audio/ogg',
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { audio_url, client_id } = await req.json()

  if (!audio_url || !client_id) {
    return new Response(JSON.stringify({ error: 'Missing audio_url or client_id' }), { status: 400 })
  }

  // Download audio file
  const audioRes = await fetch(audio_url)
  if (!audioRes.ok) {
    return new Response(JSON.stringify({ error: `Failed to download audio: ${audioRes.status}` }), { status: 400 })
  }

  const audioBytes = await audioRes.arrayBuffer()
  const base64Audio = btoa(String.fromCharCode(...new Uint8Array(audioBytes)))

  // Determine MIME type from URL extension
  const ext = audio_url.split('.').pop()?.toLowerCase() ?? 'mp4'
  const mediaType = AUDIO_MIME_TYPES[ext] ?? 'audio/mp4'

  // Fetch intake fields
  const { data: intakeFields } = await supabase
    .from('intake_fields')
    .select('field_key, label, field_type')
    .or(`client_id.eq.${client_id},client_id.is.null`)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  const fieldList = (intakeFields ?? []).map(f => `- ${f.field_key}: ${f.label}`).join('\n')

  const systemPrompt = `You are a transcription and data extraction assistant for a contractor CRM.
Transcribe the audio and extract structured customer information from it.

Return ONLY a valid JSON object with exactly this structure:
{
  "transcript": "<full transcription of the audio>",
  "fields": {
${fieldList}
    "full_name": "<customer full name or null>",
    "email": "<email or null>",
    "phone": "<phone number or null>",
    "property_address": "<service address or null>",
    "service_type": "<type of service or null>",
    "notes": "<other relevant info or null>",
    "urgency": "<low|medium|high|emergency or null>",
    "preferred_date": "<YYYY-MM-DD or null>"
  }
}

Rules:
- transcript must be the complete verbatim transcription
- fields must only contain information actually spoken in the audio
- Use null for fields not mentioned
- Return only the JSON object`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 2048,
    system: systemPrompt,
    messages: [{
      role: 'user',
      content: [{
        type: 'document',
        source: {
          type: 'base64',
          media_type: mediaType as 'audio/mpeg' | 'audio/mp4' | 'audio/wav' | 'audio/webm' | 'audio/ogg',
          data: base64Audio,
        },
      } as unknown as Anthropic.TextBlockParam,
      {
        type: 'text',
        text: 'Please transcribe this voice memo and extract the lead information.',
      }],
    }],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return new Response(JSON.stringify({ error: 'Unexpected response type from Claude' }), { status: 500 })
  }

  let result: { transcript: string; fields: Record<string, string | null> }
  try {
    const raw = content.text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    result = JSON.parse(raw)
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to parse Claude response as JSON', raw: content.text }), { status: 500 })
  }

  return new Response(JSON.stringify(result), {
    headers: { 'Content-Type': 'application/json' },
  })
})
