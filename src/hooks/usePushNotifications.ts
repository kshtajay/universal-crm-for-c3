import { useState, useEffect } from 'react'
import { supabase } from '../integrations/supabase/client'

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  return Uint8Array.from([...rawData].map(c => c.charCodeAt(0)))
}

type PermissionState = 'default' | 'granted' | 'denied' | 'unsupported'

interface UsePushResult {
  permission: PermissionState
  subscribed: boolean
  loading: boolean
  subscribe: () => Promise<void>
  unsubscribe: () => Promise<void>
}

export function usePushNotifications(clientId: string | null, userId: string | null): UsePushResult {
  const [permission, setPermission] = useState<PermissionState>('default')
  const [subscribed, setSubscribed] = useState(false)
  const [loading, setLoading] = useState(false)

  const supported = typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator &&
    'PushManager' in window

  useEffect(() => {
    if (!supported) { setPermission('unsupported'); return }
    setPermission(Notification.permission as PermissionState)
  }, [supported])

  const subscribe = async () => {
    if (!supported || !clientId || !userId) return
    setLoading(true)
    try {
      const perm = await Notification.requestPermission()
      setPermission(perm as PermissionState)
      if (perm !== 'granted') return

      const reg = await navigator.serviceWorker.ready
      const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY
      if (!vapidKey) { console.warn('VITE_VAPID_PUBLIC_KEY not set'); return }

      const pushSub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey).buffer as ArrayBuffer,
      })

      const subJSON = pushSub.toJSON()
      const endpoint = pushSub.endpoint
      const p256dh = subJSON.keys?.p256dh ?? ''
      const authKey = subJSON.keys?.auth ?? ''

      await supabase.from('push_subscriptions').upsert({
        client_id: clientId,
        user_id: userId,
        endpoint,
        p256dh,
        auth_key: authKey,
        subscription_json: subJSON,
        is_active: true,
        device_type: detectDeviceType(),
      }, { onConflict: 'endpoint' })

      setSubscribed(true)
    } catch (err) {
      console.error('Push subscribe failed:', err)
    } finally {
      setLoading(false)
    }
  }

  const unsubscribe = async () => {
    if (!supported) return
    setLoading(true)
    try {
      const reg = await navigator.serviceWorker.ready
      const pushSub = await reg.pushManager.getSubscription()
      if (pushSub) {
        await supabase
          .from('push_subscriptions')
          .update({ is_active: false })
          .eq('endpoint', pushSub.endpoint)
        await pushSub.unsubscribe()
      }
      setSubscribed(false)
    } finally {
      setLoading(false)
    }
  }

  return { permission, subscribed, loading, subscribe, unsubscribe }
}

function detectDeviceType(): 'ios_pwa' | 'android_pwa' | 'android_browser' | 'desktop' {
  const ua = navigator.userAgent
  const isIOS = /iPhone|iPad|iPod/.test(ua)
  const isAndroid = /Android/.test(ua)
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches
  if (isIOS && isStandalone) return 'ios_pwa'
  if (isAndroid && isStandalone) return 'android_pwa'
  if (isAndroid) return 'android_browser'
  return 'desktop'
}
