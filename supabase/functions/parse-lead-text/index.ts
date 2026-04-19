import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import Anthropic from 'https://esm.sh/@anthropic-ai/sdk@0.27?target=deno'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

const anthropic = new Anthropic({ apiKey: Deno.env.get('ANTHROPIC_API_KEY')! })

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { text, client_id } = await req.json()

  if (!text || !client_id) {
    return new Response(JSON.stringify({ error: 'Missing text or client_id' }), { status: 400 })
  }

  // Fetch intake fields to know which fields to extract
  const { data: intakeFields } = await supabase
    .from('intake_fields')
    .select('field_key, label, field_type')
    .or(`client_id.eq.${client_id},client_id.is.null`)
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  const fieldList = (intakeFields ?? []).map(f => `- ${f.field_key}: ${f.label}`).join('\n')

  const systemPrompt = `You are a data extraction assistant for a contractor CRM. Extract structured information from phone call notes or messages about a customer requesting contractor services.

Return ONLY a valid JSON object with the following fields (use null for missing values):
${fieldList}

Additional standard fields to always extract if present:
- full_name: customer's full name
- email: customer's email address
- phone: customer's phone number
- property_address: service location address
- service_type: type of service requested
- notes: any other relevant information
- urgency: one of "low", "medium", "high", "emergency"
- preferred_date: preferred service date in YYYY-MM-DD format if mentioned

Rules:
- Return only the JSON object, no explanation
- Use null for fields not found in the text
- Do not invent information not present in the text`

  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: systemPrompt,
    messages: [{ role: 'user', content: text }],
  })

  const content = message.content[0]
  if (content.type !== 'text') {
    return new Response(JSON.stringify({ error: 'Unexpected response type from Claude' }), { status: 500 })
  }

  let fields: Record<string, string | null>
  try {
    // Strip any markdown code fences if present
    const raw = content.text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim()
    fields = JSON.parse(raw)
  } catch {
    return new Response(JSON.stringify({ error: 'Failed to parse Claude response as JSON', raw: content.text }), { status: 500 })
  }

  return new Response(JSON.stringify({ fields }), {
    headers: { 'Content-Type': 'application/json' },
  })
})
