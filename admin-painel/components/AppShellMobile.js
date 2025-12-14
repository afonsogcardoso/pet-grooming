'use client'

import Image from 'next/image'
import Link from 'next/link'

export default function AppShellMobile({
  children,
  account,
  t,
  profileAvatar,
  profileDisplayName,
  pathname,
  handleLogout,
  mobileNavItems
}) {
  const isProfile = pathname?.startsWith('/profile')

  return (
    <div className="min-h-screen brand-background flex flex-col">
      <header className="flex items-center justify-between px-4 py-3 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="h-12 w-12 rounded-xl bg-white border border-slate-200 overflow-hidden">
            {account?.logo_url ? (
              <Image
                src={account.logo_url}
                alt={t('app.logoAlt', { name: account?.name || t('app.title') })}
                width={48}
                height={48}
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center text-xl">🐾</div>
            )}
          </div>
          <div className="leading-tight">
            <p className="text-[11px] uppercase tracking-[0.18em] text-slate-500">{t('app.title')}</p>
            <p className="text-base font-semibold text-slate-900 line-clamp-1">
              {account?.name || t('account.select.untitled')}
            </p>
          </div>
        </div>
        <Link
          href="/profile"
          className="h-11 w-11 rounded-full border border-slate-200 bg-white overflow-hidden flex items-center justify-center text-sm font-semibold text-slate-600 shadow-sm"
          aria-label={t('app.profile.viewProfile')}
        >
          {profileAvatar ? (
            <Image
              src={profileAvatar}
              alt={t('app.profile.viewProfile')}
              width={44}
              height={44}
              className="h-full w-full object-cover"
            />
          ) : (
            profileDisplayName?.charAt(0)?.toUpperCase() || '👤'
          )}
        </Link>
      </header>

      {isProfile && (
        <div className="px-4 pt-3">
          <button
            type="button"
            onClick={handleLogout}
            className="w-full rounded-xl border border-red-100 bg-red-50 px-4 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
          >
            ⎋ {t('account.actions.logout')}
          </button>
        </div>
      )}

      <main className="flex-1 px-3 pb-24 pt-3">{children}</main>

      <nav
        className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-6px_18px_rgba(15,23,42,0.08)] backdrop-blur"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
      >
        <div className="mx-auto flex max-w-7xl items-center justify-around gap-1">
          {mobileNavItems.map(({ href, labelKey, icon }) => {
            const isActive = pathname === href || pathname?.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-[11px] font-semibold transition ${isActive
                  ? 'bg-brand-primary text-white shadow-brand-glow'
                  : 'text-slate-600 hover:bg-slate-100'
                  }`}
              >
                <span className="text-lg leading-none">{icon}</span>
                <span className="line-clamp-1">{t(labelKey)}</span>
              </Link>
            )
          })}
        </div>
      </nav>
    </div>
  )
}
