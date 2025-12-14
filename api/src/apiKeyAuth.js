import crypto from 'crypto'
import { getSupabaseServiceRoleClient } from './authClient.js'

const KEY_HEADER = 'x-api-key'
const AUTH_HEADER = 'authorization'
const PREFIX_LENGTH = 8

function looksLikeJwt(token) {
  return typeof token === 'string' && token.split('.').length === 3
}

function extractApiKey(req) {
  const headerKey = req.headers[KEY_HEADER]
  if (headerKey) return String(headerKey).trim()

  const auth = req.headers[AUTH_HEADER]
  if (auth && auth.startsWith('Bearer ')) {
    const bearerToken = auth.slice('Bearer '.length).trim()
    // Let real JWT bearer tokens pass through to Supabase auth
    if (!looksLikeJwt(bearerToken)) {
      return bearerToken
    }
  }
  return null
}

function buildPrefix(key) {
  return key.slice(0, PREFIX_LENGTH)
}

function hashKey(key) {
  return crypto.createHash('sha256').update(key).digest('hex')
}

export async function apiKeyAuth(req, res, next) {
  // Allow OPTIONS to pass through quickly
  if (req.method === 'OPTIONS') return next()

  // Skip auth for swagger docs and health checks
  if (
    req.path?.startsWith('/docs') ||
    req.path?.startsWith('/api/docs') ||
    req.path === '/api/v1/health'
  ) {
    return next()
  }

  const rawKey = extractApiKey(req)
  if (!rawKey) return next()

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) {
    console.error('[api-key] missing service role client')
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const keyPrefix = buildPrefix(rawKey)
  const keyHash = hashKey(rawKey)

  try {
    const { data, error } = await supabaseAdmin
      .from('api_keys')
      .select('id, account_id, status')
      .eq('key_prefix', keyPrefix)
      .eq('key_hash', keyHash)
      .eq('status', 'active')
      .maybeSingle()

    if (error) {
      console.error('[api-key] lookup error', error)
      return res.status(401).json({ error: 'Invalid API key' })
    }

    if (!data) {
      return res.status(401).json({ error: 'Invalid API key' })
    }

    req.apiKeyId = data.id
    req.accountId = data.account_id

    // Best-effort last_used_at update (non-blocking)
    supabaseAdmin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('id', data.id)
      .then(() => null)
      .catch((err) => console.error('[api-key] last_used_at error', err))

    return next()
  } catch (err) {
    console.error('[api-key] unexpected error', err)
    return res.status(401).json({ error: 'Invalid API key' })
  }
}
