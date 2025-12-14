'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { setActiveAccountId } from '@/lib/accountHelpers'
import { useTranslation } from '@/components/TranslationProvider'
import { storeAuthTokens } from '@/lib/authTokens'

export default function LoginPage() {
  const { t } = useTranslation()
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setLoading(true)
    setError(null)
    setMessage(null)

    const base = (process.env.NEXT_PUBLIC_API_URL || process.env.API_BASE_URL || '').replace(/\/$/, '')
    const response = await fetch(`${base}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: email.trim(), password })
    })
    const body = await response.json().catch(() => ({}))

    if (!response.ok) {
      setError(body?.error || t('login.errors.generic'))
      setLoading(false)
      return
    }

    const token = body?.token
    const refreshToken = body?.refreshToken

    if (token) {
      storeAuthTokens({ token, refreshToken })
    }

    const accountId =
      body?.memberships?.[0]?.account_id ||
      body?.account_id ||
      null

    if (accountId) {
      setActiveAccountId(accountId)
    }

    setMessage(t('login.success'))
    setLoading(false)
    router.replace('/appointments')
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-6 rounded-3xl border border-white/50 bg-white/95 p-6 shadow-2xl backdrop-blur-lg sm:p-8">
        <div className="space-y-2 text-center">
          <div className="mx-auto h-16 w-16 rounded-2xl bg-brand-primary/10 text-3xl leading-[64px] text-brand-primary">
            🔐
          </div>
          <h1 className="text-2xl font-bold text-gray-900">{t('login.title')}</h1>
          <p className="text-gray-600">{t('login.description')}</p>
        </div>

        <div className="rounded-2xl bg-gradient-to-r from-brand-primary via-brand-accent to-brand-primary p-4 text-white shadow-lg sm:hidden">
          <p className="text-sm font-semibold">{t('login.mobile.ctaTitle')}</p>
          <p className="text-xs opacity-90">{t('login.mobile.ctaText')}</p>
        </div>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-semibold text-gray-700">
              {t('login.fields.email')}
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              inputMode="email"
              autoComplete="email"
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-lg text-gray-900 placeholder-gray-500 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              placeholder={t('login.placeholders.email')}
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-semibold text-gray-700">
              {t('login.fields.password')}
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              autoComplete="current-password"
              className="w-full rounded-xl border-2 border-gray-200 bg-white px-4 py-3 text-lg text-gray-900 placeholder-gray-500 focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary"
              placeholder={t('login.placeholders.password')}
            />
          </div>

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {message && <p className="text-sm text-emerald-600">{message}</p>}

          <button type="submit" className="btn-brand w-full rounded-2xl py-3 text-lg" disabled={loading}>
            {loading ? t('login.actions.loading') : t('login.actions.submit')}
          </button>
        </form>

        <div className="text-center text-sm text-gray-500">
          <span>{t('login.help.noAccount')}</span>{' '}
          <Link href="mailto:support@example.com" className="font-semibold text-brand-primary">
            {t('login.help.contact')}
          </Link>
        </div>
      </div>
    </div>
  )
}
