'use client'

// ============================================
// FILE: components/AccountProvider.js
// Provides the active account context for the app
// ============================================

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { clearStoredAccountId, setActiveAccountId } from '@/lib/accountHelpers'
import { clearAuthTokens, getStoredAccessToken } from '@/lib/authTokens'

const AccountContext = createContext(null)

const DEFAULT_BRANDING = {
  brand_primary: '#4fafa9',
  brand_primary_soft: '#ebf5f4',
  brand_accent: '#f4d58d',
  brand_accent_soft: '#fdf6de',
  brand_background: '#f6f9f8',
  brand_gradient: 'linear-gradient(135deg, #4fafa9, #f4d58d)',
  logo_url: null
}

const emptyState = {
  user: null,
  account: null,
  membership: null,
  memberships: [],
  loading: true,
  error: null,
  authenticated: false
}

export function AccountProvider({ children }) {
  const [state, setState] = useState(emptyState)
  const [authReady, setAuthReady] = useState(false)
  const latestUserRef = useRef(null)

  const deriveActiveMembership = useCallback(async (memberships) => {
    const preferredAccountId = getStoredAccountPreference()

    let membership = null
    if (preferredAccountId) {
      membership = memberships.find((entry) => entry.account_id === preferredAccountId) || null
    }

    if (!membership) {
      membership = memberships[0] || null
      if (membership) {
        setActiveAccountId(membership.account_id)
      } else {
        clearStoredAccountId()
      }
    }

    setState((prev) => {
      const mergedAccount = mergeAccountWithPrevious(membership?.account || null, prev.account)
      return {
        user: latestUserRef.current,
        account: mergedAccount,
        membership,
        memberships,
        loading: false,
        error: null,
        authenticated: true
      }
    })
  }, [])

  const loadProfile = useProfileLoader({ setState, deriveActiveMembership, latestUserRef })

  useEffect(() => {
    let cancelled = false

    async function bootstrap() {
      await loadProfile().catch(() => { })
      if (!cancelled) {
        setAuthReady(true)
      }
    }

    bootstrap()
    return () => {
      cancelled = true
    }
  }, [loadProfile])

  useEffect(() => {
    function handleAuthUpdated() {
      loadProfile().catch(() => { })
    }
    if (typeof window !== 'undefined') {
      window.addEventListener('auth-updated', handleAuthUpdated)
    }
    return () => {
      if (typeof window !== 'undefined') {
        window.removeEventListener('auth-updated', handleAuthUpdated)
      }
    }
  }, [loadProfile])

  const selectAccount = useCallback((accountId) => {
    if (!accountId) return
    setState((prev) => {
      const membership = prev.memberships.find((m) => m.account_id === accountId) || null
      if (!membership) return prev
      setActiveAccountId(accountId)
      return {
        ...prev,
        account: membership.account,
        membership
      }
    })
  }, [])

  const refresh = useCallback(() => {
    loadProfile()
  }, [loadProfile])

  useEffect(() => {
    let cancelled = false

    async function loadBranding() {
      if (!state.account?.id) return
      const token = getStoredAccessToken()
      if (!token) return
      const branding = await fetchBranding(token, state.account.id)
      if (!branding || cancelled) return
      setState((prev) => {
        if (!prev.account || prev.account.id !== state.account.id) return prev
        return {
          ...prev,
          account: {
            ...prev.account,
            ...branding
          }
        }
      })
    }

    loadBranding()
    return () => {
      cancelled = true
    }
  }, [state.account?.id])

  useEffect(() => {
    if (typeof document === 'undefined') return
    const root = document.documentElement
    const branding = state.account ?? DEFAULT_BRANDING
    root.style.setProperty('--brand-primary', branding.brand_primary || DEFAULT_BRANDING.brand_primary)
    root.style.setProperty(
      '--brand-primary-soft',
      branding.brand_primary_soft || DEFAULT_BRANDING.brand_primary_soft
    )
    root.style.setProperty('--brand-accent', branding.brand_accent || DEFAULT_BRANDING.brand_accent)
    root.style.setProperty(
      '--brand-accent-dark',
      branding.brand_accent ? branding.brand_accent : DEFAULT_BRANDING.brand_accent
    )
    root.style.setProperty(
      '--brand-accent-soft',
      branding.brand_accent_soft || DEFAULT_BRANDING.brand_accent_soft
    )
    root.style.setProperty(
      '--brand-secondary',
      branding.brand_primary || DEFAULT_BRANDING.brand_primary
    )
    root.style.setProperty(
      '--brand-secondary-soft',
      branding.brand_accent_soft || DEFAULT_BRANDING.brand_accent_soft
    )
    root.style.setProperty('--brand-surface', branding.brand_background || DEFAULT_BRANDING.brand_background)
    root.style.setProperty(
      '--brand-gradient',
      branding.brand_gradient || DEFAULT_BRANDING.brand_gradient
    )
    root.style.setProperty('--background', branding.brand_background || DEFAULT_BRANDING.brand_background)
  }, [state.account])

  const value = useMemo(
    () => ({
      ...state,
      authReady,
      selectAccount,
      refresh
    }),
    [state, authReady, selectAccount, refresh]
  )

  return <AccountContext.Provider value={value}>{children}</AccountContext.Provider>
}

function getStoredAccountPreference() {
  if (typeof window === 'undefined') return null
  try {
    return (
      window.sessionStorage?.getItem('activeAccountId') ||
      window.localStorage?.getItem('activeAccountId') ||
      null
    )
  } catch {
    return null
  }
}

async function fetchProfile(token) {
  const base =
    (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || '').replace(/\/$/, '')
  const url = base
    ? `${base}/api/v1/profile?includeMemberships=true`
    : '/api/v1/profile?includeMemberships=true'

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
      cache: 'no-store'
    })
    if (!response.ok) return null
    return await response.json()
  } catch {
    return null
  }
}

function mergeAccountWithPrevious(nextAccount, prevAccount) {
  if (!nextAccount) return null
  if (prevAccount && prevAccount.id === nextAccount.id) {
    // Preserve any fields (like branding) we already had locally but the profile payload omits
    return { ...nextAccount, ...prevAccount }
  }
  return nextAccount
}

async function fetchBranding(token, accountId) {
  if (!accountId) return null
  const base =
    (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || '').replace(/\/$/, '')
  const url = base ? `${base}/api/v1/branding?accountId=${accountId}` : `/api/v1/branding?accountId=${accountId}`

  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      credentials: 'include',
      cache: 'no-store'
    })
    if (!response.ok) return null
    const body = await response.json().catch(() => null)
    return body?.data || null
  } catch {
    return null
  }
}

function setUnauthenticatedState(setStateFn) {
  clearStoredAccountId()
  clearAuthTokens()
  setStateFn({
    user: null,
    account: null,
    membership: null,
    memberships: [],
    loading: false,
    error: null,
    authenticated: false
  })
}

function useProfileLoader({ setState, deriveActiveMembership, latestUserRef }) {
  return useCallback(async () => {
    setState((prev) => ({ ...prev, loading: true, error: null }))
    const token = getStoredAccessToken()
    if (!token) {
      setUnauthenticatedState(setState)
      return
    }

    const profile = await fetchProfile(token)
    if (!profile) {
      setUnauthenticatedState(setState)
      return
    }

    latestUserRef.current = profile
    const memberships = profile.memberships || []

    await deriveActiveMembership(memberships)
  }, [deriveActiveMembership, latestUserRef, setState])
}

export function useAccount() {
  const context = useContext(AccountContext)
  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider')
  }
  return context
}
