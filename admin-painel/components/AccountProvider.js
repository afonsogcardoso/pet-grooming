'use client'

// ============================================
// FILE: components/AccountProvider.js
// Provides the active account context for the app
// ============================================

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import { clearStoredAccountId, setActiveAccountId } from '@/lib/accountHelpers'
import { fetchAllActiveAccounts } from '@/lib/admin/accountFetcher'
import { clearAuthTokens, getStoredAccessToken } from '@/lib/authTokens'

const AccountContext = createContext(null)

const DEFAULT_BRANDING = {
  brand_primary: '#4fafa9',
  brand_primary_soft: '#82B1FF',
  brand_accent: '#144FA1',
  brand_accent_soft: '#DCE8FF',
  brand_background: '#f6f9f8',
  brand_gradient: 'linear-gradient(135deg, #4fafa9, #144FA1)',
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

  const isPlatformAdmin = useCallback((user) => {
    if (!user) return false
    return Boolean(user.platformAdmin)
  }, [])

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

    setState({
      user: latestUserRef.current,
      account: membership?.account || null,
      membership,
      memberships,
      loading: false,
      error: null,
      authenticated: true
    })
  }, [])

  const loadProfile = useProfileLoader({ setState, deriveActiveMembership, isPlatformAdmin, latestUserRef })

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
  const base = (process.env.API_BASE_URL || '').replace(/\/$/, '')
  const url = base ? `${base}/api/v1/profile` : '/api/v1/profile'

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

function useProfileLoader({ setState, deriveActiveMembership, isPlatformAdmin, latestUserRef }) {
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
    let memberships = profile.memberships || []

    if (isPlatformAdmin(profile)) {
      try {
        const extraAccounts = await fetchAllActiveAccounts()
        memberships = mergeMembershipsWithAdminAccounts(memberships, extraAccounts)
      } catch (adminError) {
        console.error('Failed to fetch admin accounts', adminError)
      }
    }

    await deriveActiveMembership(memberships)
  }, [deriveActiveMembership, isPlatformAdmin, setState])
}

function mergeMembershipsWithAdminAccounts(existing, adminAccounts) {
  const existingIds = new Set(existing.map((entry) => entry.account_id))
  const merged = [...existing]

  adminAccounts.forEach((entry) => {
    if (!existingIds.has(entry.account_id)) {
      merged.push(entry)
    }
  })

  return merged.sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
}

export function useAccount() {
  const context = useContext(AccountContext)
  if (!context) {
    throw new Error('useAccount must be used within an AccountProvider')
  }
  return context
}
