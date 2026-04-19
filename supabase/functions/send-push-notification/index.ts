import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
)

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const { lead_id, client_id, title, body, target = 'agent', url } = await req.json()

  if (!client_id || !title || !body) {
    return new Response(JSON.stringify({ error: 'Missing client_id, title, or body' }), { status: 400 })
  }

  // Fetch subscriptions based on target
  let query = supabase.from('push_subscriptions').select('*')

  if (target === 'agent') {
    query = query.eq('client_id', client_id)
  } else if (target === 'customer' && lead_id) {
    query = query.eq('lead_id', lead_id)
  } else {
    return new Response(JSON.stringify({ error: 'Invalid target or missing lead_id for customer push' }), { status: 400 })
  }

  const { data: subscriptions, error } = await query
  if (error) throw error
  if (!subscriptions?.length) {
    return new Response(JSON.stringify({ sent: 0, message: 'No subscriptions found' }), {
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const vapidPublicKey = Deno.env.get('VAPID_PUBLIC_KEY')!
  const vapidPrivateKey = Deno.env.get('VAPID_PRIVATE_KEY')!
  const vapidEmail = Deno.env.get('VAPID_EMAIL') ?? 'mailto:admin@example.com'

  const payload = JSON.stringify({ title, body, url })
  let sent = 0
  const staleIds: string[] = []

  for (const sub of subscriptions) {
    try {
      const pushEndpoint = sub.endpoint
      const origin = new URL(pushEndpoint).origin

      // Build VAPID JWT
      const vapidJwt = await buildVapidJwt(origin, vapidEmail, vapidPrivateKey)
      const authHeader = `vapid t=${vapidJwt},k=${vapidPublicKey}`

      // Encrypt payload using Web Push encryption (RFC 8291)
      const encrypted = await encryptPayload(payload, sub.p256dh, sub.auth)

      const pushRes = await fetch(pushEndpoint, {
        method: 'POST',
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/octet-stream',
          'Content-Encoding': 'aes128gcm',
          TTL: '86400',
        },
        body: encrypted,
      })

      if (pushRes.status === 410 || pushRes.status === 404) {
        staleIds.push(sub.id)
      } else if (pushRes.ok || pushRes.status === 201) {
        sent++
      }
    } catch (err) {
      console.error(`Push to subscription ${sub.id} failed:`, err)
    }
  }

  // Remove stale subscriptions
  if (staleIds.length) {
    await supabase.from('push_subscriptions').delete().in('id', staleIds)
  }

  // Log
  await supabase.from('push_notification_logs').insert({
    client_id,
    lead_id: lead_id ?? null,
    title,
    body,
    target,
    sent_count: sent,
  })

  return new Response(JSON.stringify({ sent, stale_removed: staleIds.length }), {
    headers: { 'Content-Type': 'application/json' },
  })
})

// ── VAPID JWT ─────────────────────────────────────────────────────────────────
async function buildVapidJwt(audience: string, subject: string, privateKeyB64: string): Promise<string> {
  const header = base64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const now = Math.floor(Date.now() / 1000)
  const claims = base64url(JSON.stringify({ aud: audience, exp: now + 43200, sub: subject }))
  const unsigned = `${header}.${claims}`

  const keyBytes = base64ToBytes(privateKeyB64)
  const cryptoKey = await crypto.subtle.importKey(
    'pkcs8',
    keyBytes,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['sign']
  )

  const sig = await crypto.subtle.sign(
    { name: 'ECDSA', hash: 'SHA-256' },
    cryptoKey,
    new TextEncoder().encode(unsigned)
  )

  return `${unsigned}.${base64url(sig)}`
}

// ── Web Push encryption (RFC 8291 / aes128gcm) ────────────────────────────────
async function encryptPayload(plaintext: string, p256dhB64: string, authB64: string): Promise<ArrayBuffer> {
  const recipientPublicKey = base64ToBytes(p256dhB64)
  const authSecret = base64ToBytes(authB64)

  // Generate sender ephemeral key pair
  const senderKeyPair = await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits']
  )

  const recipientKey = await crypto.subtle.importKey(
    'raw',
    recipientPublicKey,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    []
  )

  // ECDH shared secret
  const sharedBits = await crypto.subtle.deriveBits(
    { name: 'ECDH', public: recipientKey },
    senderKeyPair.privateKey,
    256
  )

  // Export sender public key (uncompressed)
  const senderPublicKeyRaw = await crypto.subtle.exportKey('raw', senderKeyPair.publicKey)

  // HKDF salt = random 16 bytes
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // PRK via HKDF-Extract with authSecret
  const prkKey = await crypto.subtle.importKey('raw', authSecret, 'HKDF', false, ['deriveBits'])
  const prk = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: new Uint8Array(sharedBits), info: buildInfo('WebPush: info', recipientPublicKey, new Uint8Array(senderPublicKeyRaw)) },
    prkKey,
    256
  )

  // CEK and nonce
  const cekKey = await crypto.subtle.importKey('raw', prk, 'HKDF', false, ['deriveBits'])
  const cek = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: buildInfo('Content-Encoding: aes128gcm', new Uint8Array(0), new Uint8Array(0)) },
    cekKey,
    128
  )
  const nonce = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt, info: buildInfo('Content-Encoding: nonce', new Uint8Array(0), new Uint8Array(0)) },
    cekKey,
    96
  )

  const aesKey = await crypto.subtle.importKey('raw', cek, 'AES-GCM', false, ['encrypt'])
  const encoded = new TextEncoder().encode(plaintext)
  // Add padding delimiter byte (0x02)
  const padded = new Uint8Array(encoded.length + 1)
  padded.set(encoded)
  padded[encoded.length] = 2

  const ciphertext = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: nonce },
    aesKey,
    padded
  )

  // Build aes128gcm content encoding header
  const header = new Uint8Array(21 + senderPublicKeyRaw.byteLength)
  header.set(salt, 0)                                    // 16 bytes salt
  new DataView(header.buffer).setUint32(16, 4096, false) // record size
  header[20] = senderPublicKeyRaw.byteLength             // key length
  header.set(new Uint8Array(senderPublicKeyRaw), 21)

  const result = new Uint8Array(header.byteLength + ciphertext.byteLength)
  result.set(header, 0)
  result.set(new Uint8Array(ciphertext), header.byteLength)
  return result.buffer
}

function buildInfo(type: string, clientKey: Uint8Array, serverKey: Uint8Array): Uint8Array {
  const typeBytes = new TextEncoder().encode(type + '\0')
  const info = new Uint8Array(typeBytes.length + 2 + clientKey.length + 2 + serverKey.length)
  let offset = 0
  info.set(typeBytes, offset); offset += typeBytes.length
  new DataView(info.buffer).setUint16(offset, clientKey.length, false); offset += 2
  info.set(clientKey, offset); offset += clientKey.length
  new DataView(info.buffer).setUint16(offset, serverKey.length, false); offset += 2
  info.set(serverKey, offset)
  return info
}

function base64url(input: string | ArrayBuffer): string {
  const bytes = typeof input === 'string'
    ? new TextEncoder().encode(input)
    : new Uint8Array(input)
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function base64ToBytes(b64: string): Uint8Array {
  const padded = b64.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(b64.length / 4) * 4, '=')
  return Uint8Array.from(atob(padded), c => c.charCodeAt(0))
}
