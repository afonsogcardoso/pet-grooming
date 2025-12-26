import { Router } from 'express'
import multer from 'multer'
import { getSupabaseClientWithAuth, getSupabaseServiceRoleClient } from '../authClient.js'

const router = Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } })
const ALLOWED_LOCALES = ['pt', 'en']
const AVATAR_BUCKET = 'profiles'

async function getAuthenticatedUser(req) {
  const supabase = getSupabaseClientWithAuth(req)
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  return data.user
}

function isPlatformAdmin(user) {
  if (!user) return false
  const metadata = user.user_metadata || {}
  const appMeta = user.app_metadata || {}
  const roles = Array.isArray(appMeta.roles) ? appMeta.roles : []
  return (
    metadata.platform_admin === true ||
    metadata.platform_admin === 'true' ||
    appMeta.platform_admin === true ||
    appMeta.platform_admin === 'true' ||
    roles.includes('platform_admin')
  )
}

router.get('/', async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const { data: memberships, error } = await supabaseAdmin
    .from('account_members')
    .select('id, account_id, role, status, created_at, accounts ( id, name, slug, logo_url, brand_primary, brand_primary_soft, brand_accent, brand_accent_soft, brand_background, brand_gradient )')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })

  const payload = {
    id: user.id,
    email: user.email,
    user_metadata: user.user_metadata || {},
    app_metadata: user.app_metadata || {},
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    platformAdmin: isPlatformAdmin(user),
    memberships: (memberships || []).map((m) => ({
      ...m,
      account: m.accounts || null
    }))
  }

  res.json(payload)
})

router.patch('/', async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { displayName, firstName, lastName, phone, locale, avatarUrl } = req.body || {}
  const metadataUpdates = {}
  const trimmedFirstName = firstName?.toString().trim()
  const trimmedLastName = lastName?.toString().trim()
  if (trimmedFirstName !== undefined) metadataUpdates.first_name = trimmedFirstName || null
  if (trimmedLastName !== undefined) metadataUpdates.last_name = trimmedLastName || null
  if (displayName !== undefined) metadataUpdates.display_name = displayName?.trim() || null
  if ((trimmedFirstName || trimmedLastName) && displayName === undefined) {
    metadataUpdates.display_name = [trimmedFirstName, trimmedLastName].filter(Boolean).join(' ') || null
  }
  if (phone !== undefined) metadataUpdates.phone = phone?.trim() || null
  if (locale !== undefined) {
    const normalized = ALLOWED_LOCALES.includes(locale) ? locale : null
    metadataUpdates.preferred_locale = normalized || null
  }
  if (avatarUrl !== undefined) metadataUpdates.avatar_url = avatarUrl || null

  if (!Object.keys(metadataUpdates).length) {
    return res.status(400).json({ error: 'No updates provided' })
  }

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const mergedMetadata = {
    ...(user.user_metadata || {}),
    ...metadataUpdates
  }

  const { data, error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: mergedMetadata
  })

  if (error) return res.status(500).json({ error: error.message })
  const updatedUser = data.user
  const updatedFirstName = updatedUser?.user_metadata?.first_name ?? null
  const updatedLastName = updatedUser?.user_metadata?.last_name ?? null
  const updatedDisplayName =
    updatedUser?.user_metadata?.display_name ||
    [updatedFirstName, updatedLastName].filter(Boolean).join(' ') ||
    updatedUser?.email ||
    null
  return res.json({
    user: {
      id: updatedUser?.id,
      email: updatedUser?.email,
      displayName: updatedDisplayName,
      firstName: updatedFirstName,
      lastName: updatedLastName,
      phone: updatedUser?.user_metadata?.phone ?? null,
      locale: updatedUser?.user_metadata?.preferred_locale ?? null,
      avatarUrl: updatedUser?.user_metadata?.avatar_url ?? null,
      lastLoginAt: updatedUser?.last_sign_in_at ?? null,
      createdAt: updatedUser?.created_at ?? null,
      platformAdmin: isPlatformAdmin(updatedUser)
    }
  })
})

router.post('/avatar', upload.single('file'), async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const file = req.file
  if (!file) return res.status(400).json({ error: 'No file provided' })

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const ext = (file.originalname?.split('.').pop() || 'jpg').toLowerCase()
  const path = `avatars/${user.id}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabaseAdmin.storage
    .from(AVATAR_BUCKET)
    .upload(path, file.buffer, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.mimetype || 'image/jpeg'
    })

  if (uploadError) {
    return res.status(500).json({ error: uploadError.message })
  }

  // Gerar signed URL (7 dias)
  const { data: signedUrlData, error: signedError } = await supabaseAdmin.storage
    .from('profiles')
    .createSignedUrl(path, 604800) // 7 dias

  if (signedError) return res.status(500).json({ error: signedError.message })

  // Atualizar user metadata com a URL
  const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    user_metadata: { avatar_url: signedUrlData?.signedUrl }
  })

  return res.json({ url: signedUrlData?.signedUrl || null })
})

router.post('/reset-password', async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { newPassword } = req.body || {}
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'Password inválida (min 8 chars)' })
  }

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Service unavailable' })

  const { error } = await supabaseAdmin.auth.admin.updateUserById(user.id, {
    password: newPassword
  })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true })
})

export default router
