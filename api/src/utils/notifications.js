import { Expo } from 'expo-server-sdk'

const expo = new Expo()

export const DEFAULT_NOTIFICATION_PREFERENCES = {
  push: {
    enabled: false,
    appointments: {
      created: true,
      confirmed: true,
      cancelled: true,
      reminder: true
    },
    marketplace: {
      request: true
    },
    payments: {
      updated: true
    },
    marketing: false
  }
}

const PREFERENCE_PATHS = {
  'appointments.created': ['push', 'appointments', 'created'],
  'appointments.confirmed': ['push', 'appointments', 'confirmed'],
  'appointments.cancelled': ['push', 'appointments', 'cancelled'],
  'appointments.reminder': ['push', 'appointments', 'reminder'],
  'marketplace.request': ['push', 'marketplace', 'request'],
  'payments.updated': ['push', 'payments', 'updated'],
  marketing: ['push', 'marketing']
}

function cloneDefaults() {
  return JSON.parse(JSON.stringify(DEFAULT_NOTIFICATION_PREFERENCES))
}

function coerceBoolean(value, fallback) {
  return typeof value === 'boolean' ? value : fallback
}

export function normalizeNotificationPreferences(input) {
  const source = input && typeof input === 'object' ? input : {}
  const push = source.push && typeof source.push === 'object' ? source.push : {}
  const appointments =
    push.appointments && typeof push.appointments === 'object' ? push.appointments : {}
  const marketplace =
    push.marketplace && typeof push.marketplace === 'object' ? push.marketplace : {}
  const payments = push.payments && typeof push.payments === 'object' ? push.payments : {}

  return {
    push: {
      enabled: coerceBoolean(push.enabled, DEFAULT_NOTIFICATION_PREFERENCES.push.enabled),
      appointments: {
        created: coerceBoolean(
          appointments.created,
          DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.created
        ),
        confirmed: coerceBoolean(
          appointments.confirmed,
          DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.confirmed
        ),
        cancelled: coerceBoolean(
          appointments.cancelled,
          DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.cancelled
        ),
        reminder: coerceBoolean(
          appointments.reminder,
          DEFAULT_NOTIFICATION_PREFERENCES.push.appointments.reminder
        )
      },
      marketplace: {
        request: coerceBoolean(
          marketplace.request,
          DEFAULT_NOTIFICATION_PREFERENCES.push.marketplace.request
        )
      },
      payments: {
        updated: coerceBoolean(
          payments.updated,
          DEFAULT_NOTIFICATION_PREFERENCES.push.payments.updated
        )
      },
      marketing: coerceBoolean(push.marketing, DEFAULT_NOTIFICATION_PREFERENCES.push.marketing)
    }
  }
}

export function mergeNotificationPreferences(existing, updates) {
  const base = normalizeNotificationPreferences(existing)
  const source = updates && typeof updates === 'object' ? updates : {}
  const push = source.push && typeof source.push === 'object' ? source.push : {}
  const appointments =
    push.appointments && typeof push.appointments === 'object' ? push.appointments : {}
  const marketplace =
    push.marketplace && typeof push.marketplace === 'object' ? push.marketplace : {}
  const payments = push.payments && typeof push.payments === 'object' ? push.payments : {}

  return {
    push: {
      enabled: coerceBoolean(push.enabled, base.push.enabled),
      appointments: {
        created: coerceBoolean(appointments.created, base.push.appointments.created),
        confirmed: coerceBoolean(appointments.confirmed, base.push.appointments.confirmed),
        cancelled: coerceBoolean(appointments.cancelled, base.push.appointments.cancelled),
        reminder: coerceBoolean(appointments.reminder, base.push.appointments.reminder)
      },
      marketplace: {
        request: coerceBoolean(marketplace.request, base.push.marketplace.request)
      },
      payments: {
        updated: coerceBoolean(payments.updated, base.push.payments.updated)
      },
      marketing: coerceBoolean(push.marketing, base.push.marketing)
    }
  }
}

export function shouldSendNotification(preferences, type) {
  const resolved = normalizeNotificationPreferences(preferences)
  if (!resolved.push.enabled) return false
  const path = PREFERENCE_PATHS[type]
  if (!path) return false
  let current = resolved
  for (const key of path) {
    if (!current || typeof current !== 'object') return false
    current = current[key]
  }
  return typeof current === 'boolean' ? current : false
}

async function loadPreferencesForUsers(supabaseAdmin, userIds) {
  const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean)))
  const preferencesByUser = new Map()
  uniqueIds.forEach((userId) => {
    preferencesByUser.set(userId, cloneDefaults())
  })

  if (!uniqueIds.length) return preferencesByUser

  const { data, error } = await supabaseAdmin
    .from('notification_preferences')
    .select('user_id, preferences')
    .in('user_id', uniqueIds)

  if (error) {
    console.error('[notifications] load preferences error', error)
    return preferencesByUser
  }

  ;(data || []).forEach((row) => {
    if (!row?.user_id) return
    preferencesByUser.set(row.user_id, normalizeNotificationPreferences(row.preferences))
  })

  return preferencesByUser
}

async function loadPushTokensForUsers(supabaseAdmin, userIds) {
  const uniqueIds = Array.from(new Set((userIds || []).filter(Boolean)))
  const tokensByUser = new Map()
  if (!uniqueIds.length) return tokensByUser

  const { data, error } = await supabaseAdmin
    .from('notification_devices')
    .select('user_id, push_token, device_id')
    .in('user_id', uniqueIds)
    .eq('enabled', true)

  if (error) {
    console.error('[notifications] load devices error', error)
    return tokensByUser
  }

  ;(data || []).forEach((row) => {
    if (!row?.user_id || !row?.push_token) return
    const bucket = tokensByUser.get(row.user_id) || []
    bucket.push({ token: row.push_token, deviceId: row.device_id || null })
    tokensByUser.set(row.user_id, bucket)
  })

  return tokensByUser
}

export async function sendPushNotifications({
  supabaseAdmin,
  userIds,
  title,
  body,
  data,
  type,
  accountId
}) {
  if (!supabaseAdmin) return { sent: 0, failed: 0, skipped: 0 }
  const recipients = Array.from(new Set((userIds || []).filter(Boolean)))
  if (!recipients.length) return { sent: 0, failed: 0, skipped: 0 }

  const [preferencesByUser, tokensByUser] = await Promise.all([
    loadPreferencesForUsers(supabaseAdmin, recipients),
    loadPushTokensForUsers(supabaseAdmin, recipients)
  ])

  const eligible = []
  recipients.forEach((userId) => {
    const preferences = preferencesByUser.get(userId) || cloneDefaults()
    if (!shouldSendNotification(preferences, type)) return
    const tokens = tokensByUser.get(userId) || []
    const validTokens = tokens.filter((item) => Expo.isExpoPushToken(item.token))
    if (!validTokens.length) return
    eligible.push({ userId, tokens: validTokens })
  })

  if (!eligible.length) {
    return { sent: 0, failed: 0, skipped: recipients.length }
  }

  const payload = data && typeof data === 'object' ? data : {}
  const inserted = await supabaseAdmin
    .from('notifications')
    .insert(
      eligible.map((entry) => ({
        user_id: entry.userId,
        account_id: accountId || null,
        type,
        channel: 'push',
        title: title || null,
        body: body || null,
        payload
      }))
    )
    .select('id, user_id')

  if (inserted.error) {
    console.error('[notifications] insert logs error', inserted.error)
  }

  const notificationIdByUser = new Map(
    (inserted.data || []).map((row) => [row.user_id, row.id])
  )

  const messages = []
  const messageMeta = []
  eligible.forEach((entry) => {
    const notificationId = notificationIdByUser.get(entry.userId) || null
    entry.tokens.forEach((item) => {
      messages.push({
        to: item.token,
        sound: 'default',
        title,
        body,
        data: { ...payload, type }
      })
      messageMeta.push({ userId: entry.userId, token: item.token, notificationId })
    })
  })

  if (!messages.length) return { sent: 0, failed: 0, skipped: recipients.length }

  const statusByNotification = new Map()
  const invalidTokens = new Set()
  let sentCount = 0
  let failedCount = 0

  try {
    const chunks = expo.chunkPushNotifications(messages)
    let offset = 0
    for (const chunk of chunks) {
      const receipts = await expo.sendPushNotificationsAsync(chunk)
      receipts.forEach((receipt, index) => {
        const meta = messageMeta[offset + index]
        if (!meta) return
        if (receipt.status === 'ok') {
          sentCount += 1
          const status = statusByNotification.get(meta.notificationId) || { ok: false, error: null }
          status.ok = true
          statusByNotification.set(meta.notificationId, status)
          return
        }
        failedCount += 1
        const status = statusByNotification.get(meta.notificationId) || { ok: false, error: null }
        status.ok = status.ok || false
        status.error =
          status.error ||
          receipt.message ||
          receipt.details?.error ||
          'push_failed'
        statusByNotification.set(meta.notificationId, status)
        if (receipt.details?.error === 'DeviceNotRegistered') {
          invalidTokens.add(meta.token)
        }
      })
      offset += receipts.length
    }
  } catch (error) {
    console.error('[notifications] push send error', error)
    failedCount += messages.length
  }

  if (invalidTokens.size) {
    await supabaseAdmin
      .from('notification_devices')
      .update({ enabled: false })
      .in('push_token', Array.from(invalidTokens))
  }

  if (notificationIdByUser.size) {
    const now = new Date().toISOString()
    const sentIds = []
    const failedIds = []
    const failedErrors = {}

    notificationIdByUser.forEach((notificationId) => {
      const status = statusByNotification.get(notificationId)
      if (status?.ok) {
        sentIds.push(notificationId)
      } else {
        failedIds.push(notificationId)
        if (status?.error) {
          failedErrors[notificationId] = status.error
        }
      }
    })

    if (sentIds.length) {
      await supabaseAdmin
        .from('notifications')
        .update({ status: 'sent', sent_at: now })
        .in('id', sentIds)
    }

    if (failedIds.length) {
      const { data: failedRows, error: failedError } = await supabaseAdmin
        .from('notifications')
        .select('id')
        .in('id', failedIds)
      if (failedError) {
        console.error('[notifications] load failed logs error', failedError)
      } else {
        const updates = (failedRows || []).map((row) => ({
          id: row.id,
          status: 'failed',
          error: failedErrors[row.id] || 'push_failed'
        }))
        if (updates.length) {
          await supabaseAdmin.from('notifications').upsert(updates, { onConflict: 'id' })
        }
      }
    }
  }

  return { sent: sentCount, failed: failedCount, skipped: recipients.length - eligible.length }
}
