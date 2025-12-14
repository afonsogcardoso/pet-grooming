import express from 'express'
import { getSupabaseServiceRoleClient } from '../authClient.js'

const router = express.Router()

function normalizeSlug(slug) {
  return slug?.toString().trim().toLowerCase() || ''
}

router.get('/accounts/:slug', async (req, res) => {
  const slug = normalizeSlug(req.params.slug)
  if (!slug) return res.status(400).json({ error: 'Missing slug' })

  const supabaseAdmin = getSupabaseServiceRoleClient()
  if (!supabaseAdmin) return res.status(500).json({ error: 'Supabase client not configured' })

  const { data, error } = await supabaseAdmin
    .from('accounts')
    .select(
      'id, name, slug, logo_url, portal_image_url, support_email, support_phone, brand_primary, brand_primary_soft, brand_accent, brand_accent_soft, brand_background, brand_gradient'
    )
    .eq('slug', slug)
    .eq('is_active', true)
    .maybeSingle()

  if (error) return res.status(500).json({ error: error.message })
  if (!data) return res.status(404).json({ error: 'Not found' })

  res.json({ account: data })
})

export default router
