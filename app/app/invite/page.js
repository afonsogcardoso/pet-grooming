'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import { useRouter, useSearchParams } from 'next/navigation'
import { useTranslation } from '@/components/TranslationProvider'
import { supabase } from '@/lib/supabase'
import { storeAuthTokens } from '@/lib/authTokens'
import { setActiveAccountId } from '@/lib/accountHelpers'

function resolveApiBase() {
  const base = (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || '').replace(/\/$/, '')
  return base || ''
}

function InviteAcceptContent() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [token, setToken] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [oauthLoading, setOauthLoading] = useState(null)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [acceptedEmail, setAcceptedEmail] = useState(null)

  const tokenFromUrl = searchParams?.get('token') || ''

  useEffect(() => {
    if (tokenFromUrl) {
      setToken(tokenFromUrl)
      setError(null)
    } else {
      setError(t('inviteAccept.errors.missingToken'))
    }
  }, [tokenFromUrl, t])

  const disabled = !token || loading

  const apiBase = useMemo(() => resolveApiBase(), [])

  const handleAccept = async (event) => {
    event.preventDefault()
    if (!token) {
      setError(t('inviteAccept.errors.missingToken'))
      return
    }
    setLoading(true)
    setError(null)
    setMessage(null)

    try {
      const response = await fetch(`${apiBase}/api/v1/account/members/accept`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password: password.trim() || undefined })
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body?.error || t('inviteAccept.errors.generic'))
      }
      setAcceptedEmail(body?.member?.email || null)
      setMessage(t('inviteAccept.success'))

      const providedPassword = password.trim()
      if (providedPassword && body?.member?.email) {
        // Auto-login with the password the user just set
        const loginRes = await fetch(`${apiBase}/api/v1/auth/login`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: body.member.email, password: providedPassword })
        })
        const loginBody = await loginRes.json().catch(() => ({}))
        if (loginRes.ok) {
          const token = loginBody?.token
          const refreshToken = loginBody?.refreshToken
          if (token) {
            storeAuthTokens({ token, refreshToken })
          }
          const accountId =
            loginBody?.memberships?.[0]?.account_id ||
            loginBody?.account_id ||
            null
          if (accountId) {
            setActiveAccountId(accountId)
          }
          router.replace('/appointments')
          return
        }
        if (!loginRes.ok) {
          setError(loginBody?.error || t('inviteAccept.errors.generic'))
        }
      }
      setPassword('')
    } catch (err) {
      setError(err.message || t('inviteAccept.errors.generic'))
    } finally {
      setLoading(false)
    }
  }

  const handleOAuth = async (provider) => {
    setOauthLoading(provider)
    setError(null)
    try {
      if (typeof window === 'undefined') {
        throw new Error()
      }
      const redirectUrl = new URL('/auth/callback', window.location.origin)
      redirectUrl.searchParams.set('next', '/appointments')
      const { data, error: oauthError } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: redirectUrl.toString(),
          skipBrowserRedirect: true,
          scopes: provider === 'apple' ? 'name email' : undefined
        }
      })
      if (oauthError || !data?.url) {
        throw new Error()
      }
      window.location.assign(data.url)
    } catch {
      setError(t('inviteAccept.errors.oauth', { provider: provider }))
    } finally {
      setOauthLoading(null)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full max-w-xl space-y-6 rounded-3xl border border-white/50 bg-white/95 p-6 shadow-2xl backdrop-blur-lg sm:p-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-brand-primary/10 text-3xl leading-[64px] text-brand-primary">
            ✉️
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('inviteAccept.title')}</h1>
          <p className="text-gray-600">{t('inviteAccept.description')}</p>
        </div>

        <form className="space-y-4" onSubmit={handleAccept}>
          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-semibold text-gray-700">
              {t('inviteAccept.fields.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-lg text-gray-900 placeholder-gray-500 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              placeholder={t('inviteAccept.placeholders.password')}
            />
            <p className="mt-1 text-xs text-gray-500">{t('inviteAccept.helper.password')}</p>
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {message && <p className="text-sm text-emerald-600">{message}</p>}

          <button
            type="submit"
            className="btn-brand w-full rounded-2xl py-3 text-lg"
            disabled={disabled}
          >
            {loading ? t('inviteAccept.actions.submitting') : t('inviteAccept.actions.submit')}
          </button>
        </form>

        <div className="flex items-center gap-3 text-xs font-semibold uppercase tracking-[0.3em] text-gray-400">
          <span className="h-px flex-1 bg-gray-200" />
          <span>{t('inviteAccept.or')}</span>
          <span className="h-px flex-1 bg-gray-200" />
        </div>

        <div className="space-y-3">
          <button
            type="button"
            className="flex w-full items-center justify-center gap-3 rounded-2xl border-2 border-gray-200 bg-white px-4 py-3 text-base font-semibold text-gray-900 transition hover:border-brand-primary focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
            onClick={() => handleOAuth('google')}
            disabled={loading || oauthLoading !== null}
            aria-busy={oauthLoading === 'google'}
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-gray-100">
              <Image
                src="/icons/google.svg"
                alt={t('inviteAccept.actions.google')}
                width={16}
                height={16}
                className="h-4 w-4"
                aria-hidden="true"
              />
            </span>
            {oauthLoading === 'google' ? t('inviteAccept.actions.loading') : t('inviteAccept.actions.google')}
          </button>
        </div>

        <div className="rounded-xl bg-gray-50 px-4 py-3 text-sm text-gray-600">
          {t('inviteAccept.footer')}
        </div>

        <div className="text-center text-sm text-gray-500">
          <button
            type="button"
            className="font-semibold text-brand-primary underline-offset-4 hover:underline"
            onClick={() => router.replace('/login')}
          >
            {t('inviteAccept.actions.backToLogin')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function InviteAcceptPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
          <div className="w-full max-w-xl text-center text-sm text-gray-600">Loading...</div>
        </div>
      }
    >
      <InviteAcceptContent />
    </Suspense>
  )
}
