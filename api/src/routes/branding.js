import { Router } from 'express'
import multer from 'multer'
import { getSupabaseServiceRoleClient } from '../authClient.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
const BRANDING_BUCKET = 'account-branding'

const DEFAULT_BRANDING = {
  account_name: 'Pet Grooming',
  brand_primary: '#1e40af',
  brand_primary_soft: 'rgba(30, 64, 175, 0.08)',
  brand_accent: '#0891b2',
  brand_accent_soft: 'rgba(8, 145, 178, 0.08)',
  brand_background: '#ffffff',
  brand_gradient: null,
  logo_url: null,
  portal_image_url: null,
  support_email: null,
  support_phone: null,
  marketplace_description: null,
  marketplace_instagram_url: null,
  marketplace_facebook_url: null,
  marketplace_tiktok_url: null,
  marketplace_website_url: null
}

function getBearer(req) {
  const auth = req.headers.authorization || ''
  if (typeof auth === 'string' && auth.startsWith('Bearer ')) {
    return auth.slice('Bearer '.length)
  }
  return null
}

async function resolveAccountId(req, supabaseAdmin) {
  if (req.accountId) return req.accountId
  if (req.query.accountId) return req.query.accountId
  if (!supabaseAdmin) return null

  const token = getBearer(req)
  if (!token) return null

  const { data: userData } = await supabaseAdmin.auth.getUser(token)
  const userId = userData?.user?.id
  if (!userId) return null

  const { data: membership } = await supabaseAdmin
    .from('account_members')
    .select('account_id')
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .order('created_at', { ascending: true })
    .limit(1)
    .maybeSingle()

  if (membership?.account_id) return membership.account_id
  return null
}

async function ensureOwnerOrAdmin(req, supabase, accountId) {
  const token = getBearer(req)
  if (!token) return { ok: false, status: 401, error: 'Unauthorized' }

  const { data: userData, error: userError } = await supabase.auth.getUser(token)
  if (userError || !userData?.user?.id) return { ok: false, status: 401, error: 'Unauthorized' }

  const userId = userData.user.id
  const { data: membership } = await supabase
    .from('account_members')
    .select('role, status')
    .eq('account_id', accountId)
    .eq('user_id', userId)
    .eq('status', 'accepted')
    .maybeSingle()

  const isAllowed = membership && ['owner', 'admin'].includes(membership.role)
  if (!isAllowed) {
    return { ok: false, status: 403, error: 'Forbidden' }
  }
  return { ok: true, userId }
}

router.get('/', async (req, res) => {
  const supabase = getSupabaseServiceRoleClient()
  const accountId = await resolveAccountId(req, supabase)

  if (!supabase || !accountId) {
    return res.json({ data: DEFAULT_BRANDING })
  }

  const { data, error } = await supabase
    .from('accounts')
    .select(
      `
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
      marketplace_description,
      marketplace_instagram_url,
      marketplace_facebook_url,
      marketplace_tiktok_url,
      marketplace_website_url
    `
    )
    .eq('id', accountId)
    .maybeSingle()

  if (error) {
    console.error('[api] branding error', error)
    return res.json({ data: DEFAULT_BRANDING })
  }

  if (!data) {
    return res.json({ data: DEFAULT_BRANDING })
  }

  return res.json({
    data: {
      ...DEFAULT_BRANDING,
      account_name: data.name || DEFAULT_BRANDING.account_name,
      brand_primary: data.brand_primary || DEFAULT_BRANDING.brand_primary,
      brand_primary_soft: data.brand_primary_soft || DEFAULT_BRANDING.brand_primary_soft,
      brand_accent: data.brand_accent || DEFAULT_BRANDING.brand_accent,
      brand_accent_soft: data.brand_accent_soft || DEFAULT_BRANDING.brand_accent_soft,
      brand_background: data.brand_background || DEFAULT_BRANDING.brand_background,
      brand_gradient: data.brand_gradient || DEFAULT_BRANDING.brand_gradient,
      logo_url: data.logo_url || DEFAULT_BRANDING.logo_url,
      portal_image_url: data.portal_image_url || DEFAULT_BRANDING.portal_image_url,
      support_email: data.support_email || DEFAULT_BRANDING.support_email,
      support_phone: data.support_phone || DEFAULT_BRANDING.support_phone,
      marketplace_description: data.marketplace_description || DEFAULT_BRANDING.marketplace_description,
      marketplace_instagram_url:
        data.marketplace_instagram_url || DEFAULT_BRANDING.marketplace_instagram_url,
      marketplace_facebook_url:
        data.marketplace_facebook_url || DEFAULT_BRANDING.marketplace_facebook_url,
      marketplace_tiktok_url:
        data.marketplace_tiktok_url || DEFAULT_BRANDING.marketplace_tiktok_url,
      marketplace_website_url:
        data.marketplace_website_url || DEFAULT_BRANDING.marketplace_website_url
    }
  })
})

router.patch('/', async (req, res) => {
  const supabase = getSupabaseServiceRoleClient()
  const accountId = await resolveAccountId(req, supabase)
  if (!supabase || !accountId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const allowed = await ensureOwnerOrAdmin(req, supabase, accountId)
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
    'marketplace_description',
    'marketplace_instagram_url',
    'marketplace_facebook_url',
    'marketplace_tiktok_url',
    'marketplace_website_url'
  ]

  const nullableFields = new Set([
    'logo_url',
    'portal_image_url',
    'support_email',
    'support_phone',
    'marketplace_description',
    'marketplace_instagram_url',
    'marketplace_facebook_url',
    'marketplace_tiktok_url',
    'marketplace_website_url'
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

  const { data, error } = await supabase
    .from('accounts')
    .update(updates)
    .eq('id', accountId)
    .select(
      `
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
      marketplace_description,
      marketplace_instagram_url,
      marketplace_facebook_url,
      marketplace_tiktok_url,
      marketplace_website_url
    `
    )
    .maybeSingle()

  if (error) {
    console.error('[api] branding patch error', error)
    return res.status(500).json({ error: error.message })
  }

  return res.json({
    data: {
      ...DEFAULT_BRANDING,
      account_name: data?.name || DEFAULT_BRANDING.account_name,
      brand_primary: data?.brand_primary || DEFAULT_BRANDING.brand_primary,
      brand_primary_soft: data?.brand_primary_soft || DEFAULT_BRANDING.brand_primary_soft,
      brand_accent: data?.brand_accent || DEFAULT_BRANDING.brand_accent,
      brand_accent_soft: data?.brand_accent_soft || DEFAULT_BRANDING.brand_accent_soft,
      brand_background: data?.brand_background || DEFAULT_BRANDING.brand_background,
      brand_gradient: data?.brand_gradient || DEFAULT_BRANDING.brand_gradient,
      logo_url: data?.logo_url || DEFAULT_BRANDING.logo_url,
      portal_image_url: data?.portal_image_url || DEFAULT_BRANDING.portal_image_url,
      support_email: data?.support_email || DEFAULT_BRANDING.support_email,
      support_phone: data?.support_phone || DEFAULT_BRANDING.support_phone,
      marketplace_description: data?.marketplace_description || DEFAULT_BRANDING.marketplace_description,
      marketplace_instagram_url:
        data?.marketplace_instagram_url || DEFAULT_BRANDING.marketplace_instagram_url,
      marketplace_facebook_url:
        data?.marketplace_facebook_url || DEFAULT_BRANDING.marketplace_facebook_url,
      marketplace_tiktok_url:
        data?.marketplace_tiktok_url || DEFAULT_BRANDING.marketplace_tiktok_url,
      marketplace_website_url:
        data?.marketplace_website_url || DEFAULT_BRANDING.marketplace_website_url
    }
  })
})

router.post('/logo', upload.single('file'), async (req, res) => {
  const supabase = getSupabaseServiceRoleClient()
  const accountId = await resolveAccountId(req, supabase)
  if (!supabase || !accountId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const allowed = await ensureOwnerOrAdmin(req, supabase, accountId)
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

  return res.json({ url: publicUrl })
})

router.post('/portal-image', upload.single('file'), async (req, res) => {
  const supabase = getSupabaseServiceRoleClient()
  const accountId = await resolveAccountId(req, supabase)
  if (!supabase || !accountId) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const allowed = await ensureOwnerOrAdmin(req, supabase, accountId)
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

  return res.json({ url: publicUrl })
})

export default router
