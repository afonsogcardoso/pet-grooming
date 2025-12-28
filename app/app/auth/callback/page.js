'use client'

import { Suspense, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import { storeAuthTokens } from '@/lib/authTokens'
import { useTranslation } from '@/components/TranslationProvider'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

function createOauthClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    return null
  }

  return createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: true
    }
  })
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={<AuthCallbackFallback />}>
      <AuthCallbackContent />
    </Suspense>
  )
}

function AuthCallbackFallback() {
  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-4 rounded-3xl border border-white/50 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-lg sm:p-8">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-brand-primary/10 text-3xl leading-[64px] text-brand-primary">
          🔐
        </div>
        <p className="text-lg font-semibold text-gray-900">Loading...</p>
      </div>
    </div>
  )
}

function AuthCallbackContent() {
  const { t } = useTranslation()
  const router = useRouter()
  const searchParams = useSearchParams()
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function finalizeLogin() {
      const supabase = createOauthClient()
      if (!supabase) {
        setError(t('login.errors.oauthCallback'))
        return
      }

      const { data, error: sessionError } = await supabase.auth.getSession()
      if (cancelled) return

      if (sessionError || !data?.session?.access_token) {
        setError(t('login.errors.oauthCallback'))
        return
      }

      storeAuthTokens({
        token: data.session.access_token,
        refreshToken: data.session.refresh_token
      })

      const nextPath = searchParams?.get('next') || '/appointments'
      router.replace(nextPath)
    }

    finalizeLogin()
    return () => {
      cancelled = true
    }
  }, [router, searchParams, t])

  return (
    <div className="flex min-h-screen items-center justify-center px-4 py-10 sm:px-6 lg:px-8">
      <div className="w-full max-w-lg space-y-4 rounded-3xl border border-white/50 bg-white/95 p-6 text-center shadow-2xl backdrop-blur-lg sm:p-8">
        <div className="mx-auto h-16 w-16 rounded-2xl bg-brand-primary/10 text-3xl leading-[64px] text-brand-primary">
          🔐
        </div>
        {error ? (
          <>
            <p className="text-base font-semibold text-rose-600">{error}</p>
            <Link href="/login" className="text-sm font-semibold text-brand-primary">
              {t('login.actions.back')}
            </Link>
          </>
        ) : (
          <p className="text-lg font-semibold text-gray-900">{t('login.actions.loading')}</p>
        )}
      </div>
    </div>
  )
}
