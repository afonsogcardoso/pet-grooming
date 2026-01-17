import { Router } from 'express'
import multer from 'multer'
import { getSupabaseServiceRoleClient } from '../authClient.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
const BRANDING_BUCKET = 'account-branding'

const DEFAULT_BRANDING = {
  account_name: 'Pawmi Account',
  brand_primary: '#4fafa9',
  brand_primary_soft: '#ebf5f4',
  brand_accent: '#f4d58d',
  brand_accent_soft: '#fdf6de',
  brand_background: '#f6f9f8',
  brand_gradient: 'linear-gradient(135deg, #4fafa9, #f4d58d)',
  logo_url: null,
  portal_image_url: null,
  support_email: null,
  support_phone: null,
  marketplace_region: null,
  marketplace_description: null,
  marketplace_instagram_url: null,
  marketplace_facebook_url: null,
  marketplace_tiktok_url: null,
  marketplace_website_url: null,
  marketplace_enabled: true
}

const ACCOUNT_COLUMNS = `
      id,
      name,
      brand_primary,
      brand_primary_soft,
      brand_accent,
      brand_accent_soft,
      brand_background,
      brand_gradient,
      logo_url,
      portal_image_url,
      support_email,
      support_phone,
      marketplace_region,
      marketplace_description,
      marketplace_instagram_url,
      marketplace_facebook_url,
      marketplace_tiktok_url,
      marketplace_website_url,
      marketplace_enabled
    `

function getBearer(req) {
  const auth = req.headers.authorization || ''
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length)
  }
  return null
}

function formatBrandingRow(row) {
  if (!row) return DEFAULT_BRANDING
  return {
    id: row.id || null,
    account_id: row.id || null,
    ...DEFAULT_BRANDING,
    account_name: row.name || DEFAULT_BRANDING.account_name,
    brand_primary: row.brand_primary || DEFAULT_BRANDING.brand_primary,
    brand_primary_soft: row.brand_primary_soft || DEFAULT_BRANDING.brand_primary_soft,
    brand_accent: row.brand_accent || DEFAULT_BRANDING.brand_accent,
    brand_accent_soft: row.brand_accent_soft || DEFAULT_BRANDING.brand_accent_soft,
    brand_background: row.brand_background || DEFAULT_BRANDING.brand_background,
    brand_gradient: row.brand_gradient || DEFAULT_BRANDING.brand_gradient,
    logo_url: row.logo_url || DEFAULT_BRANDING.logo_url,
    portal_image_url: row.portal_image_url || DEFAULT_BRANDING.portal_image_url,
    support_email: row.support_email || DEFAULT_BRANDING.support_email,
    support_phone: row.support_phone || DEFAULT_BRANDING.support_phone,
    marketplace_region: row.marketplace_region || DEFAULT_BRANDING.marketplace_region,
    marketplace_description: row.marketplace_description || DEFAULT_BRANDING.marketplace_description,
    marketplace_instagram_url: row.marketplace_instagram_url || DEFAULT_BRANDING.marketplace_instagram_url,
    marketplace_facebook_url: row.marketplace_facebook_url || DEFAULT_BRANDING.marketplace_facebook_url,
    marketplace_tiktok_url: row.marketplace_tiktok_url || DEFAULT_BRANDING.marketplace_tiktok_url,
    marketplace_website_url: row.marketplace_website_url || DEFAULT_BRANDING.marketplace_website_url,
    marketplace_enabled: typeof row.marketplace_enabled === 'boolean' ? row.marketplace_enabled : true
  }
}

async function resolveContext(req, supabase) {
  const resolvedAccountId = req.accountId || null

  // If supabase not available, prefer any account id we already have (from header or query)
  if (!supabase) return { accountId: resolvedAccountId, membership: null, userId: null, token: getBearer(req) }

  const token = getBearer(req)
  if (!token) {
    if (process.env.NODE_ENV !== 'production') console.debug('[branding.resolveContext] no bearer token; req.accountId=', req.accountId)
    return { accountId: resolvedAccountId, membership: null, userId: null, token: null }
  }

  const { data: userData } = await supabase.auth.getUser(token)
  const userId = userData?.user?.id || null
  if (!userId) return { accountId: resolvedAccountId, membership: null, userId: null, token }

  const membershipQuery = supabase
    .from('account_members')
    .select('account_id, role, status')
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (resolvedAccountId) {
    membershipQuery.eq('account_id', resolvedAccountId)
  }

  const { data: membership } = await membershipQuery

  if (process.env.NODE_ENV !== 'production') {
    try {
      console.debug('[branding.resolveContext]', {
        accountId: resolvedAccountId,
        userId,
        membership
      })
    } catch (e) {
      // ignore logging errors
    }
  }

  return {
    accountId: resolvedAccountId || membership?.account_id || null,
    membership,
    userId,
    token
  }
}

function assertOwnerOrAdmin(context) {
  const membership = context?.membership
  const isAllowed = membership && ['owner', 'admin'].includes(membership.role)
  if (!isAllowed) return { ok: false, status: 403, error: 'Forbidden' }
  return { ok: true }
}

async function fetchBrandingRow(supabase, accountId) {
  return supabase.from('accounts').select(ACCOUNT_COLUMNS).eq('id', accountId).maybeSingle()
}

async function updateBrandingRow(supabase, accountId, updates) {
  return supabase
    .from('accounts')
    .update(updates)
    .eq('id', accountId)
    .select(ACCOUNT_COLUMNS)
    .maybeSingle()
}

router.get('/', async (req, res) => {
  const supabase = getSupabaseServiceRoleClient()
  if (process.env.NODE_ENV !== 'production') {
    try {
      const hasAuth = Boolean(req.headers.authorization);
      const hasApiKey = Boolean(req.headers['x-api-key']);
      const headerAccount = req.headers['x-account-id'] || req.headers['X-Account-Id'] || req.headers['x-accountid'];
      console.debug('[branding.request] raw query=', req.query, 'hasAuth=', hasAuth, 'hasApiKey=', hasApiKey, 'headerAccount=', headerAccount, 'preReqAccountId=', req.accountId);
    } catch (e) {
      // ignore
    }
  }
  const context = await resolveContext(req, supabase)
  const accountId = context.accountId

  if (process.env.NODE_ENV !== 'production') console.debug('[branding] request for branding, resolved accountId=', accountId)

  if (!supabase || !accountId) {
    if (process.env.NODE_ENV !== 'production') console.debug('[branding] returning DEFAULT_BRANDING (no supabase or accountId)')
    return res.json({ data: DEFAULT_BRANDING })
  }

  const { data, error } = await fetchBrandingRow(supabase, accountId)

  if (error) {
    console.error('[branding] branding error', error)
    return res.json({ data: DEFAULT_BRANDING })
  }

  if (!data) {
    if (process.env.NODE_ENV !== 'production') console.debug('[branding] no account row found, returning DEFAULT_BRANDING for accountId=', accountId)
    return res.json({ data: DEFAULT_BRANDING })
  }

  if (process.env.NODE_ENV !== 'production') {
    console.debug('[branding] returning branding for accountId=', accountId, {
      id: data.id,
      brand_primary: data.brand_primary || null,
      logo_url: data.logo_url ? 'present' : 'empty'
    })
  }

  return res.json({ data: formatBrandingRow(data) })
})

router.patch('/', async (req, res) => {
  const supabase = getSupabaseServiceRoleClient()
  const context = await resolveContext(req, supabase)
  const accountId = context.accountId
  if (process.env.NODE_ENV !== 'production') {
    console.debug('[branding.patch] context', {
      accountId,
      userId: context.userId,
      membership: context.membership,
      token: context.token ? `${String(context.token).slice(0, 10)}...` : null
    })
  }

  if (!supabase || !accountId || !context.userId) {
    if (process.env.NODE_ENV !== 'production') {
      console.debug('[branding.patch] unauthorized', {
        hasSupabase: Boolean(supabase),
        accountId,
        userId: context.userId
      })
    }
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const allowed = assertOwnerOrAdmin(context)
  if (!allowed.ok) return res.status(allowed.status).json({ error: allowed.error })

  const allowedFields = [
    'brand_primary',
    'brand_primary_soft',
    'brand_accent',
    'brand_accent_soft',
    'brand_background',
    'brand_gradient',
    'logo_url',
    'portal_image_url',
    'support_email',
    'support_phone',
    'name',
    'marketplace_region',
    'marketplace_description',
    'marketplace_instagram_url',
    'marketplace_facebook_url',
    'marketplace_tiktok_url',
    'marketplace_website_url',
    'marketplace_enabled'
  ]

  const nullableFields = new Set([
    'logo_url',
    'portal_image_url',
    'support_email',
    'support_phone',
    'marketplace_region',
    'marketplace_description',
    'marketplace_instagram_url',
    'marketplace_facebook_url',
    'marketplace_tiktok_url',
    'marketplace_website_url',
    'marketplace_enabled'
  ])

  const updates = Object.entries(req.body || {}).reduce((acc, [key, value]) => {
    if (!allowedFields.includes(key)) return acc
    if (typeof value === 'string') {
      const trimmed = value.trim()
      if (!trimmed) {
        if (nullableFields.has(key)) {
          acc[key] = null
        }
        return acc
      }
      acc[key] = trimmed
      return acc
    }
    if (value === null) {
      if (nullableFields.has(key)) {
        acc[key] = null
      }
      return acc
    }
    if (value === undefined) return acc
    acc[key] = value
    return acc
  }, {})

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  const { data, error } = await updateBrandingRow(supabase, accountId, updates)

  if (error) {
    console.error('[api] branding patch error', error)
    return res.status(500).json({ error: error.message })
  }

  return res.json({ data: formatBrandingRow(data) })
})

router.post('/logo', upload.single('file'), async (req, res) => {
  const supabase = getSupabaseServiceRoleClient()
  const context = await resolveContext(req, supabase)
  const accountId = context.accountId
  if (!supabase || !accountId || !context.userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const allowed = assertOwnerOrAdmin(context)
  if (!allowed.ok) return res.status(allowed.status).json({ error: allowed.error })

  const file = req.file
  if (!file) return res.status(400).json({ error: 'No file provided' })

  const ext = (file.originalname?.split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ext.match(/^[a-z0-9]+$/) ? ext : 'jpg'
  const path = `logos/${accountId}/${Date.now()}.${safeExt}`

  const { error: uploadError } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype || 'image/jpeg',
      upsert: true
    })

  if (uploadError) {
    return res.status(500).json({ error: uploadError.message })
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path)

  const { data, error: updateError } = await updateBrandingRow(supabase, accountId, {
    logo_url: publicUrl
  })

  if (updateError) {
    return res.status(500).json({ error: updateError.message })
  }

  return res.json({ url: publicUrl, data: formatBrandingRow(data) })
})

router.post('/portal-image', upload.single('file'), async (req, res) => {
  const supabase = getSupabaseServiceRoleClient()
  const context = await resolveContext(req, supabase)
  const accountId = context.accountId
  if (!supabase || !accountId || !context.userId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const allowed = assertOwnerOrAdmin(context)
  if (!allowed.ok) return res.status(allowed.status).json({ error: allowed.error })

  const file = req.file
  if (!file) return res.status(400).json({ error: 'No file provided' })

  const ext = (file.originalname?.split('.').pop() || 'jpg').toLowerCase()
  const safeExt = ext.match(/^[a-z0-9]+$/) ? ext : 'jpg'
  const path = `portal-images/${accountId}/${Date.now()}.${safeExt}`

  const { error: uploadError } = await supabase.storage
    .from(BRANDING_BUCKET)
    .upload(path, file.buffer, {
      contentType: file.mimetype || 'image/jpeg',
      upsert: true
    })

  if (uploadError) {
    return res.status(500).json({ error: uploadError.message })
  }

  const {
    data: { publicUrl }
  } = supabase.storage.from(BRANDING_BUCKET).getPublicUrl(path)

  const { data, error: updateError } = await updateBrandingRow(supabase, accountId, {
    portal_image_url: publicUrl
  })

  if (updateError) {
    return res.status(500).json({ error: updateError.message })
  }

  return res.json({ url: publicUrl, data: formatBrandingRow(data) })
})

// Delete logo
router.delete('/logo', async (req, res) => {
  const supabase = getSupabaseServiceRoleClient()
  const context = await resolveContext(req, supabase)
  const accountId = context.accountId
  if (!supabase || !accountId || !context.userId) return res.status(401).json({ error: 'Unauthorized' })

  const allowed = assertOwnerOrAdmin(context)
  if (!allowed.ok) return res.status(allowed.status).json({ error: allowed.error })

  try {
    const { data: list, error: listErr } = await supabase.storage.from(BRANDING_BUCKET).list(`logos/${accountId}`)
    if (listErr) {
      console.error('[branding] list logos error', listErr)
      return res.status(500).json({ error: listErr.message })
    }

    const toRemove = (list || []).map((f) => `logos/${accountId}/${f.name}`)
    if (toRemove.length > 0) {
      const { error: remErr } = await supabase.storage.from(BRANDING_BUCKET).remove(toRemove)
      if (remErr) {
        console.error('[branding] remove logos error', remErr)
        return res.status(500).json({ error: remErr.message })
      }
    }

    const { data, error: updateErr } = await updateBrandingRow(supabase, accountId, { logo_url: null })
    if (updateErr) {
      console.error('[branding] update logo_url error', updateErr)
      return res.status(500).json({ error: updateErr.message })
    }

    return res.json({ data: formatBrandingRow(data) })
  } catch (e) {
    console.error('[branding] delete logo error', e)
    return res.status(500).json({ error: 'internal_error' })
  }
})

// Delete portal image
router.delete('/portal-image', async (req, res) => {
  const supabase = getSupabaseServiceRoleClient()
  const context = await resolveContext(req, supabase)
  const accountId = context.accountId
  if (!supabase || !accountId || !context.userId) return res.status(401).json({ error: 'Unauthorized' })

  const allowed = assertOwnerOrAdmin(context)
  if (!allowed.ok) return res.status(allowed.status).json({ error: allowed.error })

  try {
    const { data: list, error: listErr } = await supabase.storage.from(BRANDING_BUCKET).list(`portal-images/${accountId}`)
    if (listErr) {
      console.error('[branding] list portal images error', listErr)
      return res.status(500).json({ error: listErr.message })
    }

    const toRemove = (list || []).map((f) => `portal-images/${accountId}/${f.name}`)
    if (toRemove.length > 0) {
      const { error: remErr } = await supabase.storage.from(BRANDING_BUCKET).remove(toRemove)
      if (remErr) {
        console.error('[branding] remove portal images error', remErr)
        return res.status(500).json({ error: remErr.message })
      }
    }

    const { data, error: updateErr } = await updateBrandingRow(supabase, accountId, { portal_image_url: null })
    if (updateErr) {
      console.error('[branding] update portal_image_url error', updateErr)
      return res.status(500).json({ error: updateErr.message })
    }

    return res.json({ data: formatBrandingRow(data) })
  } catch (e) {
    console.error('[branding] delete portal image error', e)
    return res.status(500).json({ error: 'internal_error' })
  }
})

export default router
