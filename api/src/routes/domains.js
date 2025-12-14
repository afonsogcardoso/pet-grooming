import { Router } from 'express'
import { createClient } from '@supabase/supabase-js'
import { getSupabaseClientWithAuth, getSupabaseServiceRoleClient } from '../authClient.js'
import { sanitizeBody } from '../utils/payload.js'

const router = Router()

const SUPABASE_URL = process.env.SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY
const DOMAIN_ROUTER_TOKEN = process.env.DOMAIN_ROUTER_TOKEN
const DOMAIN_REGEX = /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i
const ALLOWED_RECORD_TYPES = ['txt', 'cname']

function normalizeDomain(domain) {
  if (!domain || typeof domain !== 'string') return ''
  return domain.trim().toLowerCase().replace(/\.$/, '')
}

function isValidDomain(domain) {
  if (!domain) return false
  if (domain.includes('://') || domain.includes('/')) return false
  return DOMAIN_REGEX.test(domain)
}

async function getAuthenticatedUser(req) {
  const supabase = getSupabaseClientWithAuth(req)
  if (!supabase) return null
  const { data, error } = await supabase.auth.getUser()
  if (error || !data?.user) return null
  return data.user
}

async function assertAccountAdmin(userId, accountId) {
  const supabase = getSupabaseServiceRoleClient()
  if (!supabase) return false
  const { data, error } = await supabase
    .from('account_members')
    .select('role')
    .eq('user_id', userId)
    .eq('account_id', accountId)
    .eq('status', 'accepted')
    .maybeSingle()

  if (error || !data) return false
  return ['owner', 'admin'].includes(data.role)
}

async function fetchAccount(accountId) {
  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from('accounts')
    .select('id, slug')
    .eq('id', accountId)
    .maybeSingle()

  if (error) throw new Error(error.message)
  return data
}

// Resolver for custom domain router (no user auth, uses token header)
router.get('/', async (req, res) => {
  const { domain: lookupDomain, host } = req.query || {}

  if (lookupDomain || host) {
    if (!DOMAIN_ROUTER_TOKEN) {
      return res.status(503).json({ error: 'Domain resolver disabled' })
    }
    const resolverToken = req.headers['x-domain-resolver-token']
    if (resolverToken !== DOMAIN_ROUTER_TOKEN) {
      return res.status(403).json({ error: 'Forbidden' })
    }
    const normalizedDomain = normalizeDomain(lookupDomain || host)
    if (!isValidDomain(normalizedDomain)) {
      return res.status(400).json({ error: 'Invalid domain format' })
    }
    const supabase = getSupabaseServiceRoleClient()
    const { data, error } = await supabase
      .from('custom_domains')
      .select('id, account_id, domain, slug, status, verified_at')
      .eq('domain', normalizedDomain)
      .eq('status', 'active')
      .maybeSingle()

    if (error) return res.status(500).json({ error: error.message })
    if (!data) return res.status(404).json({ error: 'Domain not found' })
    return res.json({ domain: data })
  }

  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { accountId } = req.query
  if (!accountId) return res.status(400).json({ error: 'Missing accountId' })

  const allowed = await assertAccountAdmin(user.id, accountId)
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })

  const supabase = getSupabaseServiceRoleClient()
  const { data, error } = await supabase
    .from('custom_domains')
    .select(
      'id, account_id, domain, slug, status, dns_record_type, verification_token, verification_target, last_error, last_checked_at, verified_at, created_at, updated_at'
    )
    .eq('account_id', accountId)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ domains: data || [] })
})

router.post('/', async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })

  const { accountId, domain, slug, dnsRecordType = 'txt', verificationTarget = null } =
    sanitizeBody(req.body || {})
  if (!accountId || !domain) {
    return res.status(400).json({ error: 'Missing accountId or domain' })
  }

  const normalizedDomain = normalizeDomain(domain)
  if (!isValidDomain(normalizedDomain)) {
    return res.status(400).json({ error: 'Invalid domain format' })
  }

  const recordType = dnsRecordType?.toLowerCase()
  if (!ALLOWED_RECORD_TYPES.includes(recordType)) {
    return res.status(400).json({ error: 'Invalid DNS record type' })
  }

  const allowed = await assertAccountAdmin(user.id, accountId)
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })

  let account
  try {
    account = await fetchAccount(accountId)
  } catch (err) {
    return res.status(500).json({ error: err.message })
  }
  if (!account) return res.status(404).json({ error: 'Account not found' })

  const supabase = getSupabaseServiceRoleClient()
  const normalizedSlug = (slug || account.slug || '').trim().toLowerCase()
  if (!normalizedSlug) {
    return res.status(400).json({ error: 'Missing slug' })
  }

  const { data, error } = await supabase
    .from('custom_domains')
    .insert({
      account_id: accountId,
      domain: normalizedDomain,
      slug: normalizedSlug,
      status: 'pending',
      dns_record_type: recordType,
      verification_token: randomToken(),
      verification_target: verificationTarget || null
    })
    .select(
      'id, account_id, domain, slug, status, dns_record_type, verification_token, verification_target, last_error, last_checked_at, verified_at, created_at, updated_at'
    )
    .single()

  if (error) {
    if (error.code === '23505') {
      return res.status(409).json({ error: 'Domain already exists' })
    }
    return res.status(500).json({ error: error.message })
  }

  return res.status(201).json({ domain: data })
})

router.delete('/', async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { accountId, domainId } = req.body || {}
  if (!accountId || !domainId) {
    return res.status(400).json({ error: 'Missing accountId or domainId' })
  }
  const allowed = await assertAccountAdmin(user.id, accountId)
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })

  const supabase = getSupabaseServiceRoleClient()
  const { error } = await supabase
    .from('custom_domains')
    .delete()
    .eq('id', domainId)
    .eq('account_id', accountId)

  if (error) return res.status(500).json({ error: error.message })
  return res.json({ ok: true })
})

// Verify DNS for a domain
router.post('/verify', async (req, res) => {
  const user = await getAuthenticatedUser(req)
  if (!user) return res.status(401).json({ error: 'Unauthorized' })
  const { accountId, domainId } = req.body || {}
  if (!accountId || !domainId) {
    return res.status(400).json({ error: 'Missing accountId or domainId' })
  }
  const allowed = await assertAccountAdmin(user.id, accountId)
  if (!allowed) return res.status(403).json({ error: 'Forbidden' })

  const supabase = getSupabaseServiceRoleClient()
  const { data: domain, error: fetchError } = await supabase
    .from('custom_domains')
    .select('id, domain, dns_record_type, verification_token, verification_target, status')
    .eq('id', domainId)
    .eq('account_id', accountId)
    .maybeSingle()

  if (fetchError) return res.status(500).json({ error: fetchError.message })
  if (!domain) return res.status(404).json({ error: 'Domain not found' })

  // No actual DNS check implemented; mark as verified for now
  const { error: updateError, data: updated } = await supabase
    .from('custom_domains')
    .update({ status: 'active', verified_at: new Date().toISOString(), last_error: null })
    .eq('id', domainId)
    .eq('account_id', accountId)
    .select('id, status, verified_at')
    .single()

  if (updateError) return res.status(500).json({ error: updateError.message })

  return res.json({ verification: { matched: true, domain: updated } })
})

function randomToken() {
  return Math.random().toString(36).slice(2, 10)
}

export default router
