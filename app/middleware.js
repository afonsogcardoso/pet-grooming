import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const DOMAIN_ROUTER_PATH = process.env.DOMAIN_ROUTER_PATH || '/api/domains'
const DOMAIN_ROUTER_TOKEN = process.env.DOMAIN_ROUTER_TOKEN
const CUSTOM_BASE_PATH = sanitizeBasePath(process.env.CUSTOM_DOMAIN_BASE_PATH || '/portal')
const PRIMARY_HOSTS = toSet(process.env.CUSTOM_DOMAIN_PRIMARY_HOSTS)
const SKIP_HOSTS = new Set(['localhost', '127.0.0.1', '[::1]', ...(process.env.CUSTOM_DOMAIN_SKIP_HOSTS || '').split(',').map((h) => h.trim().toLowerCase()).filter(Boolean)])
const CACHE_TTL_MS = Number(process.env.DOMAIN_ROUTER_CACHE_SECONDS || 60) * 1000
const CACHE_MISS_MS = Number(process.env.DOMAIN_ROUTER_CACHE_MISS_SECONDS || 10) * 1000
const ADMIN_PATH_PREFIX = '/admin'
const ADMIN_PORTAL_ENABLED = (process.env.ADMIN_PORTAL_ENABLED ?? 'true') !== 'false'
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SUPABASE_PROJECT_REF = getProjectRef(SUPABASE_URL)
const SUPABASE_AUTH_COOKIE = SUPABASE_PROJECT_REF ? `sb-${SUPABASE_PROJECT_REF}-auth-token` : 'sb-access-token'
const BOOTSTRAP_PLATFORM_ADMINS = toSet(process.env.NEXT_PUBLIC_PLATFORM_ADMIN_EMAILS || process.env.PLATFORM_ADMIN_EMAILS)
const PLATFORM_ADMIN_FLAG = 'platform_admin'

const domainCache = new Map()
const supabaseEdgeClient =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: {
        persistSession: false,
        autoRefreshToken: false
      }
    })
    : null

function toSet(value) {
  if (!value) return new Set()
  return new Set(
    value
      .split(',')
      .map((entry) => entry.trim().toLowerCase())
      .filter(Boolean)
  )
}

function sanitizeBasePath(value) {
  if (!value) return '/portal'
  let base = value.trim()
  if (!base.startsWith('/')) {
    base = `/${base}`
  }
  if (base.length > 1 && base.endsWith('/')) {
    base = base.slice(0, -1)
  }
  return base
}

function normalizeHost(hostHeader) {
  if (!hostHeader) return ''
  return hostHeader.trim().toLowerCase().split(':')[0]
}

function isSystemPath(pathname) {
  return (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname.startsWith('/favicon') ||
    pathname.startsWith('/robots')
  )
}

function isPublicRewritePath(pathname) {
  return pathname === '/' || pathname === '' || pathname === '/login'
}

function getCachedDomain(host) {
  const cached = domainCache.get(host)
  if (!cached) return null
  if (cached.expiresAt < Date.now()) {
    domainCache.delete(host)
    return null
  }
  return cached.value
}

function setCachedDomain(host, value, ttlMs) {
  domainCache.set(host, {
    value,
    expiresAt: Date.now() + ttlMs
  })
}

async function fetchDomainForHost(host, request) {
  if (!DOMAIN_ROUTER_TOKEN) {
    return null
  }

  const cached = getCachedDomain(host)
  if (cached !== null) {
    return cached
  }

  const lookupUrl = new URL(DOMAIN_ROUTER_PATH, request.url)
  lookupUrl.searchParams.set('domain', host)

  try {
    const response = await fetch(lookupUrl, {
      headers: {
        'x-domain-resolver-token': DOMAIN_ROUTER_TOKEN
      },
      cache: 'no-store'
    })

    if (response.status === 404) {
      setCachedDomain(host, null, CACHE_MISS_MS)
      return null
    }

    if (!response.ok) {
      console.error('Domain lookup failed', response.status)
      setCachedDomain(host, null, CACHE_MISS_MS)
      return null
    }

    const payload = await response.json()
    const domain = payload?.domain || null
    setCachedDomain(host, domain, CACHE_TTL_MS)
    return domain
  } catch (error) {
    console.error('Domain lookup error', error)
    setCachedDomain(host, null, CACHE_MISS_MS)
    return null
  }
}

function buildRewritePath(pathname, slug) {
  if (pathname === '/') {
    return `${CUSTOM_BASE_PATH}/${slug}`
  }
  const suffix = pathname.startsWith('/') ? pathname : `/${pathname}`
  return `${CUSTOM_BASE_PATH}/${slug}${suffix}`
}

export async function middleware(request) {
  const pathname = request.nextUrl.pathname

  if (isAdminPath(pathname)) {
    if (pathname === `${ADMIN_PATH_PREFIX}/login`) {
      return NextResponse.next()
    }
    const adminResponse = await guardAdminRequest(request)
    if (adminResponse) {
      return adminResponse
    }

    return NextResponse.next()
  }

  const hostHeader = request.headers.get('host')
  const hostname = normalizeHost(hostHeader)

  if (!hostname || SKIP_HOSTS.has(hostname) || PRIMARY_HOSTS.has(hostname)) {
    return NextResponse.next()
  }

  if (isSystemPath(pathname)) {
    return NextResponse.next()
  }

  const domain = await fetchDomainForHost(hostname, request)
  if (!domain || !domain.slug) {
    return NextResponse.next()
  }

  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-custom-domain', hostname)
  requestHeaders.set('x-account-slug', domain.slug)

  if (isPublicRewritePath(pathname)) {
    const rewriteUrl = request.nextUrl.clone()
    const targetPath =
      pathname === '/login'
        ? `${CUSTOM_BASE_PATH}/${domain.slug}/login`
        : `${CUSTOM_BASE_PATH}/${domain.slug}`
    rewriteUrl.pathname = targetPath

    const response = NextResponse.rewrite(rewriteUrl, {
      request: {
        headers: requestHeaders
      }
    })
    response.headers.set('x-custom-domain-slug', domain.slug)
    return response
  }

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  })
}

export const config = {
  matcher: ['/((?!_next/|api/|favicon.ico|robots.txt).*)']
}

function isAdminPath(pathname) {
  return pathname === ADMIN_PATH_PREFIX || pathname.startsWith(`${ADMIN_PATH_PREFIX}/`)
}

async function guardAdminRequest(request) {
  if (!ADMIN_PORTAL_ENABLED) {
    return NextResponse.json(
      { message: 'Admin portal is disabled. Set ADMIN_PORTAL_ENABLED=true to re-enable.' },
      { status: 503 }
    )
  }

  if (!supabaseEdgeClient) {
    console.error('Missing Supabase env variables for admin middleware')
    return NextResponse.json({ message: 'Admin portal misconfigured' }, { status: 500 })
  }

  const accessToken = getSupabaseAccessToken(request)
  if (!accessToken) {
    return redirectToLogin(request, 'no_session')
  }

  try {
    const { data, error } = await supabaseEdgeClient.auth.getUser(accessToken)
    if (error || !data?.user) {
      return redirectToLogin(request, 'invalid_session')
    }

    if (!isPlatformAdmin(data.user)) {
      return NextResponse.redirect(buildUrl('/', request, { adminError: 'forbidden' }))
    }
  } catch (error) {
    console.error('Failed to validate platform admin', error)
    return NextResponse.redirect(buildUrl('/', request, { adminError: 'internal_error' }))
  }

  return null
}

function isPlatformAdmin(user) {
  if (!user) return false

  if (user.email && BOOTSTRAP_PLATFORM_ADMINS.has(user.email.toLowerCase())) {
    return true
  }
  const fromUserMetadata = extractFlag(user.user_metadata)
  const fromAppMetadata = extractFlag(user.app_metadata) || hasRole(user.app_metadata)

  return fromUserMetadata || fromAppMetadata
}

function extractFlag(metadata) {
  if (!metadata) return false
  const value = metadata[PLATFORM_ADMIN_FLAG]
  return value === true || value === 'true' || value === 1 || value === '1'
}

function hasRole(appMetadata) {
  if (!appMetadata) return false
  const roles = Array.isArray(appMetadata.roles) ? appMetadata.roles : []
  return roles.includes(PLATFORM_ADMIN_FLAG)
}

function redirectToLogin(request, reason) {
  const redirectTarget = `${request.nextUrl.pathname}${request.nextUrl.search}`
  return NextResponse.redirect(
    buildUrl(`${ADMIN_PATH_PREFIX}/login`, request, {
      redirectTo: redirectTarget,
      adminError: reason
    })
  )
}

function buildUrl(path, request, params = {}) {
  const url = new URL(path, request.url)
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    url.searchParams.set(key, value)
  })
  return url
}

function getProjectRef(url) {
  if (!url) return null
  try {
    const { hostname } = new URL(url)
    const [projectRef] = hostname.split('.')
    return projectRef || null
  } catch {
    return null
  }
}

function getSupabaseAccessToken(request) {
  const cookieValue =
    request.cookies.get(SUPABASE_AUTH_COOKIE)?.value || request.cookies.get('sb-access-token')?.value

  if (!cookieValue) return null

  const token = parseAccessToken(cookieValue)
  return token || cookieValue
}

function parseAccessToken(value) {
  const decoded = safeDecode(value)
  const parsed = toJson(decoded)

  if (!parsed) return null

  if (Array.isArray(parsed)) {
    const [first] = parsed
    if (typeof first === 'string') {
      return first
    }
  }

  if (parsed?.currentSession?.access_token) {
    return parsed.currentSession.access_token
  }
  if (parsed?.access_token) {
    return parsed.access_token
  }
  if (parsed?.value?.access_token) {
    return parsed.value.access_token
  }

  return null
}

function safeDecode(value) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

function toJson(value) {
  try {
    const parsed = JSON.parse(value)
    if (typeof parsed === 'string') {
      return JSON.parse(parsed)
    }
    return parsed
  } catch {
    return null
  }
}
