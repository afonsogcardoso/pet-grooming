import { Router } from 'express'
import { Expo } from 'expo-server-sdk'
import { getSupabaseServiceRoleClient } from '../authClient.js'
import { getAuthenticatedUser } from '../utils/auth.js'
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  mergeNotificationPreferences,
  normalizeNotificationPreferences
} from '../utils/notifications.js'

const router = Router()

function normalizePlatform(value) {
  if (!value) return null
  const normalized = value.toString().toLowerCase()
  if (['ios', 'android', 'web'].includes(normalized)) return normalized
  return null
}

function pickPreferencesPayload(body) {
  if (!body || typeof body !== 'object') return {}
  if (body.preferences && typeof body.preferences === 'object') {
    return body.preferences
  }
  return body
}

router.get('/preferences', async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const { data, error } = await supabaseAdmin
    .from('notification_preferences')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle()

  if (error) {
    console.error('[notifications] load preferences error', error)
    return res.status(500).json({ error: error.message })
  }

  const preferences = normalizeNotificationPreferences(data?.preferences || DEFAULT_NOTIFICATION_PREFERENCES)
  return res.json({ preferences })
})

router.put('/preferences', async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const payload = pickPreferencesPayload(req.body || {})
  const { data: existing, error: loadError } = await supabaseAdmin
    .from('notification_preferences')
    .select('preferences')
    .eq('user_id', user.id)
    .maybeSingle()

  if (loadError) {
    console.error('[notifications] load preferences error', loadError)
    return res.status(500).json({ error: loadError.message })
  }

  const merged = mergeNotificationPreferences(
    existing?.preferences || DEFAULT_NOTIFICATION_PREFERENCES,
    payload
  )

  const { error: upsertError } = await supabaseAdmin
    .from('notification_preferences')
    .upsert({ user_id: user.id, preferences: merged }, { onConflict: 'user_id' })

  if (upsertError) {
    console.error('[notifications] save preferences error', upsertError)
    return res.status(500).json({ error: upsertError.message })
  }

  return res.json({ preferences: merged })
})

router.post('/push/register', async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const { pushToken, token, deviceId, device_id, platform } = req.body || {}
  const resolvedToken = pushToken || token
  if (!resolvedToken || typeof resolvedToken !== 'string') {
    return res.status(400).json({ error: 'push_token_required' })
  }

  if (!Expo.isExpoPushToken(resolvedToken)) {
    return res.status(400).json({ error: 'invalid_push_token' })
  }

  const resolvedPlatform = normalizePlatform(platform)
  const resolvedDeviceId = (deviceId || device_id)?.toString().trim() || null
  const now = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('notification_devices')
    .upsert(
      {
        user_id: user.id,
        push_token: resolvedToken,
        device_id: resolvedDeviceId,
        platform: resolvedPlatform,
        provider: 'expo',
        enabled: true,
        last_seen_at: now
      },
      { onConflict: 'push_token' }
    )
    .select()
    .maybeSingle()

  if (error) {
    console.error('[notifications] register device error', error)
    return res.status(500).json({ error: error.message })
  }

  return res.json({ device: data || null })
})

router.post('/push/unregister', async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const { pushToken, token, deviceId, device_id } = req.body || {}
  const resolvedToken = pushToken || token
  const resolvedDeviceId = deviceId || device_id

  if (!resolvedToken && !resolvedDeviceId) {
    return res.status(400).json({ error: 'push_token_or_device_id_required' })
  }

  let query = supabaseAdmin
    .from('notification_devices')
    .update({ enabled: false })
    .eq('user_id', user.id)

  if (resolvedToken) {
    query = query.eq('push_token', resolvedToken)
  }
  if (resolvedDeviceId) {
    query = query.eq('device_id', resolvedDeviceId)
  }

  const { error } = await query
  if (error) {
    console.error('[notifications] unregister device error', error)
    return res.status(500).json({ error: error.message })
  }

  return res.json({ ok: true })
})

export default router
