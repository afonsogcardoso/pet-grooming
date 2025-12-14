'use client'

// ============================================
// FILE: components/AccountGate.js
// Blocks UI until an account is available/selected
// ============================================

import { useEffect, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { useAccount } from './AccountProvider'
import { useTranslation } from './TranslationProvider'

export default function AccountGate({ children }) {
  const { t } = useTranslation()
  const router = useRouter()
  const {
    loading,
    error,
    memberships,
    membership,
    account,
    selectAccount,
    refresh,
    authenticated,
    authReady
  } = useAccount()

  const membershipCards = useMemo(
    () =>
      memberships.map((entry) => {
        const isActive = membership?.account_id === entry.account_id
        return (
          <button
            key={entry.account_id}
            type="button"
            disabled={isActive}
            onClick={() => selectAccount(entry.account_id)}
            className={`w-full text-left border rounded-xl p-4 transition ${
              isActive
                ? 'bg-brand-primary text-white border-brand-primary shadow-brand-glow'
                : 'bg-white hover:border-brand-primary hover:shadow'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-lg font-semibold">
                  {entry.account?.name || t('account.select.untitled')}
                </p>
                <p className="text-sm opacity-80">
                  {entry.account?.plan ? t('account.select.plan', { plan: entry.account.plan }) : ''}
                </p>
              </div>
              {isActive && (
                <span className="text-xs uppercase tracking-wide font-bold">
                  {t('account.select.activeBadge')}
                </span>
              )}
            </div>
          </button>
        )
      }),
    [memberships, membership, selectAccount, t]
  )

  useEffect(() => {
    if (authReady && !loading && !authenticated) {
      router.replace('/login')
    }
  }, [authenticated, loading, authReady, router])

  if (!authenticated && !loading) {
    return null
  }

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-10 text-center space-y-3">
        <p className="text-xl font-semibold">{t('account.status.loading')}</p>
        <p className="text-gray-500">{t('account.status.subtext')}</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-rose-200 p-10 text-center space-y-4">
        <p className="text-xl font-semibold text-rose-600">{t('account.status.error')}</p>
        <p className="text-gray-600">{error.message}</p>
        <button className="btn-brand px-6 py-3" onClick={refresh}>
          {t('account.status.retry')}
        </button>
      </div>
    )
  }

  if (!memberships.length) {
    return (
      <div className="bg-white rounded-2xl border border-yellow-200 p-10 text-center space-y-4">
        <p className="text-2xl font-bold text-yellow-800">{t('account.empty.title')}</p>
        <p className="text-gray-600">{t('account.empty.description')}</p>
      </div>
    )
  }

  if (!membership || !account) {
    return (
      <div className="bg-white rounded-2xl shadow-md border border-gray-100 p-8 space-y-6">
        <div>
          <p className="text-2xl font-bold text-gray-900">{t('account.select.title')}</p>
          <p className="text-gray-600">{t('account.select.description')}</p>
        </div>
        <div className="grid gap-4">{membershipCards}</div>
      </div>
    )
  }

  return children
}
