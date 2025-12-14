'use client'

import { useState } from 'react'
import { useTranslation } from '@/components/TranslationProvider'

export default function ResetPasswordForm() {
  const { t } = useTranslation()
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [status, setStatus] = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event) => {
    event.preventDefault()
    setStatus(null)

    if (password.length < 8) {
      setStatus({ type: 'error', text: t('profile.passwordForm.errors.length') })
      return
    }

    if (password !== confirmPassword) {
      setStatus({ type: 'error', text: t('profile.passwordForm.errors.mismatch') })
      return
    }

    setLoading(true)
    try {
      const response = await fetch('/api/v1/profile/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword: password })
      })
      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || t('profile.passwordForm.errors.update'))
      }
      setStatus({ type: 'success', text: t('profile.passwordForm.success') })
      setPassword('')
      setConfirmPassword('')
    } catch (error) {
      setStatus({ type: 'error', text: error.message })
    } finally {
      setLoading(false)
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div>
        <label className="block text-sm font-semibold text-slate-600">
          {t('profile.passwordForm.labels.new')}
        </label>
        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
          placeholder={t('profile.passwordForm.placeholders.password')}
        />
      </div>
      <div>
        <label className="block text-sm font-semibold text-slate-600">
          {t('profile.passwordForm.labels.confirm')}
        </label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(event) => setConfirmPassword(event.target.value)}
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-900 focus:border-slate-500 focus:outline-none"
          placeholder={t('profile.passwordForm.placeholders.password')}
        />
      </div>
      {status && (
        <p
          className={`rounded-lg px-3 py-2 text-sm ${
            status.type === 'success' ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
          }`}
        >
          {status.text}
        </p>
      )}
      <button
        type="submit"
        disabled={loading}
        className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {loading ? t('profile.passwordForm.buttons.saving') : t('profile.passwordForm.buttons.submit')}
      </button>
    </form>
  )
}
