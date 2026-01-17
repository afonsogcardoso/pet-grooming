import { Router } from 'express'
import { getSupabaseServiceRoleClient } from '../authClient.js'
import { getAuthenticatedUser } from '../utils/auth.js'
import { resolveActiveRole, mergeAvailableRoles, normalizeUserRole, parseAvailableRoles, collectAuthProviders, isPlatformAdmin } from '../utils/user.js'

const router = Router()

async function fetchBranding(supabase, accountId) {
  const { data, error } = await supabase
    .from('accounts')
    .select(
      'id, name, brand_primary, brand_primary_soft, brand_accent, brand_accent_soft, brand_background, brand_gradient, logo_url, portal_image_url, support_email, support_phone, marketplace_region, marketplace_description, marketplace_instagram_url, marketplace_facebook_url, marketplace_tiktok_url, marketplace_website_url, marketplace_enabled'
    )
    .eq('id', accountId)
    .maybeSingle()
  if (error || !data) return null
  return {
    id: data.id,
    account_id: data.id,
    account_name: data.name,
    brand_primary: data.brand_primary,
    brand_primary_soft: data.brand_primary_soft,
    brand_accent: data.brand_accent,
    brand_accent_soft: data.brand_accent_soft,
    brand_background: data.brand_background,
    brand_gradient: data.brand_gradient,
    logo_url: data.logo_url,
    portal_image_url: data.portal_image_url,
    support_email: data.support_email,
    support_phone: data.support_phone,
    marketplace_region: data.marketplace_region,
    marketplace_description: data.marketplace_description,
    marketplace_instagram_url: data.marketplace_instagram_url,
    marketplace_facebook_url: data.marketplace_facebook_url,
    marketplace_tiktok_url: data.marketplace_tiktok_url,
    marketplace_website_url: data.marketplace_website_url,
    marketplace_enabled: data.marketplace_enabled
  }
}

router.get('/bootstrap', async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const accountId = req.accountId || null
  if (!accountId) return res.status(400).json({ error: 'Missing accountId' })

  const supabase = getSupabaseServiceRoleClient()
  if (!supabase) return res.status(503).json({ error: 'Service unavailable' })

  const { data: memberships, error: membershipError } = await supabase
    .from('account_members')
    .select('id, account_id, role, status, created_at, accounts ( id, name, slug, logo_url, brand_primary, brand_primary_soft, brand_accent, brand_accent_soft, brand_background, brand_gradient )')
    .eq('user_id', user.id)
    .order('created_at', { ascending: true })

  if (membershipError) return res.status(500).json({ error: membershipError.message })

  const { data: profileRow } = await supabase
    .from('profiles')
    .select('display_name, first_name, last_name, avatar_url, phone, phone_country_code, preferred_locale, address, address_2')
    .eq('id', user.id)
    .maybeSingle()

  const meta = user.user_metadata || {}
  const profile = {
    id: user.id,
    email: user.email,
    authProviders: collectAuthProviders(user),
    created_at: user.created_at,
    last_sign_in_at: user.last_sign_in_at,
    platformAdmin: isPlatformAdmin(user),
    memberships: (memberships || []).map((m) => ({
      ...m,
      account: m.accounts || null
    })),
    displayName:
      profileRow?.display_name ||
      meta.display_name ||
      meta.full_name ||
      [meta.first_name, meta.last_name].filter(Boolean).join(' ') ||
      user.email ||
      null,
    firstName: profileRow?.first_name ?? meta.first_name ?? null,
    lastName: profileRow?.last_name ?? meta.last_name ?? null,
    avatarUrl: profileRow?.avatar_url ?? meta.avatar_url ?? null,
    phone: profileRow?.phone ?? meta.phone ?? meta.phone_number ?? null,
    phoneNumber: meta.phone_number ?? profileRow?.phone ?? null,
    phoneCountryCode: profileRow?.phone_country_code ?? meta.phone_country_code ?? null,
    address: profileRow?.address ?? meta.address ?? null,
    address2: profileRow?.address_2 ?? meta.address_2 ?? null,
    locale: profileRow?.preferred_locale ?? meta.preferred_locale ?? null
  }

  const membershipCount = (memberships || []).filter((m) => m?.status === 'accepted').length
  let availableRoles = mergeAvailableRoles(
    parseAvailableRoles(user.user_metadata?.available_roles),
    normalizeUserRole(user.user_metadata?.active_role)
  )
  if (membershipCount === 0) {
    availableRoles = ['consumer']
  }
  profile.availableRoles = availableRoles
  profile.activeRole = resolveActiveRole({
    availableRoles,
    activeRole: user.user_metadata?.active_role
  })

  const branding = await fetchBranding(supabase, accountId)

  return res.json({
    profile,
    branding
  })
})

export default router
