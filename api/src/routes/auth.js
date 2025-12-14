import express from 'express'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseClientWithAuth } from '../authClient.js'

const router = express.Router()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY

function ensureSupabaseConfig(res) {
  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).json({ error: 'Auth not configured (SUPABASE_URL/ANON_KEY missing)' })
    return null
  }
  return createClient(supabaseUrl, supabaseAnonKey)
}

router.post('/auth/login', async (req, res) => {
  const { email, password } = req.body || {}
  if (!email || !password) {
    return res.status(400).json({ error: 'Email e password obrigatórios' })
  }

  const supabase = ensureSupabaseConfig(res)
  if (!supabase) return

  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error || !data?.session) {
    return res.status(401).json({ error: error?.message || 'Credenciais inválidas' })
  }

  const { session, user } = data
  return res.json({
    token: session.access_token,
    refreshToken: session.refresh_token,
    email: user?.email,
    displayName: user?.user_metadata?.display_name ?? user?.email ?? null
  })
})

router.post('/auth/refresh', async (req, res) => {
  const { refreshToken } = req.body || {}
  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token obrigatório' })
  }

  const supabase = ensureSupabaseConfig(res)
  if (!supabase) return

  const { data, error } = await supabase.auth.refreshSession({ refresh_token: refreshToken })
  if (error || !data?.session) {
    return res.status(401).json({ error: error?.message || 'Refresh inválido' })
  }

  const { session, user } = data
  return res.json({
    token: session.access_token,
    refreshToken: session.refresh_token,
    email: user?.email,
    displayName: user?.user_metadata?.display_name ?? user?.email ?? null
  })
})

router.get('/profile', async (req, res) => {
  const supabase = getSupabaseClientWithAuth(req)
  if (!supabase) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) {
    return res.status(401).json({ error: error?.message || 'Unauthorized' })
  }

  const user = data.user
  const roles = user?.app_metadata?.roles || []
  const platformAdmin =
    Boolean(user?.user_metadata?.platform_admin) ||
    Boolean(user?.app_metadata?.platform_admin) ||
    roles.includes('platform_admin')

  const { data: memberships, error: membershipError } = await supabase
    .from('account_members')
    .select(
      `
      account_id,
      role,
      status,
      created_at,
      account:accounts (id, name, slug, plan)
    `
    )
    .eq('user_id', user.id)
    .eq('status', 'accepted')
    .order('created_at', { ascending: true })

  if (membershipError) {
    console.error('profile memberships error', membershipError)
  }

  return res.json({
    id: user.id,
    email: user.email,
    displayName: user.user_metadata?.display_name ?? user.email ?? null,
    phone: user.user_metadata?.phone ?? null,
    locale: user.user_metadata?.preferred_locale ?? 'pt',
    avatarUrl: user.user_metadata?.avatar_url ?? null,
    lastLoginAt: user.last_sign_in_at ?? null,
    createdAt: user.created_at ?? null,
    memberships: memberships || [],
    platformAdmin
  })
})

export default router
