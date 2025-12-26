'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import AccountGate from './AccountGate'
import { useTranslation } from './TranslationProvider'
import { clearStoredAccountId } from '@/lib/accountHelpers'
import { useAccount } from './AccountProvider'
import AppShellMobile from './AppShellMobile'
import { clearAuthTokens } from '@/lib/authTokens'

const navItems = [
  {
    href: '/appointments',
    labelKey: 'app.nav.appointments',
    icon: '📅'
  },
  {
    href: '/customers',
    labelKey: 'app.nav.customers',
    icon: '👥'
  },
  {
    href: '/services',
    labelKey: 'app.nav.services',
    icon: '🧴'
  },
  {
    href: '/settings',
    labelKey: 'app.nav.settings',
    icon: '⚙️'
  }
]

const mobileNavItems = [
  {
    href: '/appointments',
    labelKey: 'app.nav.appointments',
    icon: '📅'
  },
  {
    href: '/customers',
    labelKey: 'app.nav.customers',
    icon: '👥'
  },
  {
    href: '/services',
    labelKey: 'app.nav.services',
    icon: '🧴'
  },
  {
    href: '/profile',
    labelKey: 'app.profile.viewProfile',
    icon: '👤'
  }
]

export default function AppShell({ children }) {
  const pathname = usePathname()
  const router = useRouter()
  const { t } = useTranslation()
  const { authenticated, account, membership, memberships, selectAccount, user } = useAccount()
  const [logoError, setLogoError] = useState(false)
  const [compactCollapsed, setCompactCollapsed] = useState(true)
  const defaultLogo = '/brand-logo.png'
  const [menuOpen, setMenuOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [compactProfileMenuOpen, setCompactProfileMenuOpen] = useState(false)
  const profileMenuRef = useRef(null)
  const compactProfileMenuRef = useRef(null)
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    setMenuOpen(false)
    setProfileMenuOpen(false)
  }, [pathname])

  useEffect(() => {
    function handleClickAway(event) {
      if (profileMenuRef.current && !profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false)
      }
      if (compactProfileMenuRef.current && !compactProfileMenuRef.current.contains(event.target)) {
        setCompactProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickAway)
    return () => {
      document.removeEventListener('mousedown', handleClickAway)
    }
  }, [])

  useEffect(() => {
    if (!authenticated) {
      setFreshAvatar(null)
      setFreshDisplayName(null)
      return
    }
    const meta = user?.user_metadata || {}
    const avatarUrl = meta.avatar_url || null
    const nextDisplayName = meta.display_name || user?.email || null
    if (avatarUrl) setFreshAvatar(avatarUrl)
    if (nextDisplayName) setFreshDisplayName(nextDisplayName)
  }, [authenticated, user])

  useEffect(() => {
    if (typeof window === 'undefined') return
    const mq = window.matchMedia('(max-width: 1024px)')
    const handle = (event) => setIsMobile(event.matches)
    setIsMobile(mq.matches)
    mq.addEventListener('change', handle)
    return () => mq.removeEventListener('change', handle)
  }, [])

  const isTenantPublicRoute = pathname?.startsWith('/portal/')
  const publicRoutes = ['/login', '/appointments/confirm', '/marketplace']
  const isRootRoute = pathname === '/'
  const isPublicRoute =
    isRootRoute || isTenantPublicRoute || publicRoutes.some((route) => pathname?.startsWith(route))
  const fullBleedPublicRoutes = ['/appointments/confirm', '/marketplace']
  const isFullBleedPublic =
    isRootRoute || (isPublicRoute && fullBleedPublicRoutes.some((route) => pathname?.startsWith(route)))
  const isLoginRoute = pathname?.startsWith('/login')
  const isAdminRoute = pathname?.startsWith('/admin')
  const isCompactCalendar = pathname?.startsWith('/appointments/compact')
  const userMetadata = user?.user_metadata || {}
  const baseAvatar = userMetadata.avatar_url || null
  const baseDisplayName = userMetadata.display_name || user?.email
  const [freshAvatar, setFreshAvatar] = useState(null)
  const [freshDisplayName, setFreshDisplayName] = useState(null)
  const profileAvatar = freshAvatar || baseAvatar
  const profileDisplayName = freshDisplayName || baseDisplayName
  const availableNavItems = navItems.filter((item) => {
    if (item.href !== '/settings') return true
    return ['owner', 'admin', 'platform_admin'].includes(membership?.role)
  })
  const mobileItems = mobileNavItems.filter((item) => item.href !== '/settings')

  const handleLogout = async () => {
    try {
    } catch (error) {
      console.error('Failed to sign out completely', error)
    } finally {
      clearStoredAccountId()
      clearAuthTokens()
      router.push('/login')
    }
  }

  if (isAdminRoute) {
    // Admin shell has its own layout and guards
    return <>{children}</>
  }

  if (isFullBleedPublic) {
    return <div className="min-h-screen brand-background">{children}</div>
  }

  if (isTenantPublicRoute) {
    return <div className="min-h-screen brand-background">{children}</div>
  }

  if (isLoginRoute) {
    return <div className="min-h-screen brand-background">{children}</div>
  }

  if (isCompactCalendar) {
    return (
      <div className="min-h-screen brand-background">
        <AccountGate>
          <div className="relative flex min-h-screen">
            <div className="flex min-h-screen w-full">
              <aside
                className={`hidden lg:flex ${compactCollapsed ? 'w-16 px-2' : 'w-56 px-4'} shrink-0 flex-col border-r border-slate-200 bg-white/90 backdrop-blur py-5 gap-3 transition-all relative z-30 overflow-visible`}
              >
                <Link
                  href="/appointments"
                  className={`flex h-16 w-full items-center ${compactCollapsed ? 'justify-center' : 'gap-3'} text-sm font-semibold text-slate-700 hover:text-brand-primary transition`}
                  title={t('app.nav.appointments')}
                >
                  <div className="h-full w-full flex items-center justify-center">
                    {logoError ? (
                      <span className="text-2xl">🐾</span>
                    ) : (
                      <Image
                        src={account?.logo_url || defaultLogo}
                        alt={t('app.logoAlt', { name: account?.name || t('app.title') })}
                        width={72}
                        height={72}
                        className="h-full w-full object-cover rounded-xl"
                        onError={() => setLogoError(true)}
                      />
                    )}
                  </div>
                  {!compactCollapsed && (
                    <span className="truncate flex-1 text-left">{account?.name || t('app.title')}</span>
                  )}
                </Link>
                <nav className="flex flex-col gap-2">
                  {availableNavItems.map(({ href, labelKey, icon }) => {
                    const isActive = pathname === href
                    return (
                      <Link
                        key={href}
                        href={href}
                        aria-current={isActive ? 'page' : undefined}
                        className={`flex items-center ${compactCollapsed ? 'justify-center' : 'gap-2'} rounded-xl border px-3 py-2 text-sm font-semibold transition ${isActive
                          ? 'border-brand-primary bg-brand-primary text-white shadow-brand-glow'
                          : 'border-slate-200 bg-white text-slate-600 hover:border-brand-primary/60 hover:text-slate-900'
                          }`}
                        title={t(labelKey)}
                      >
                        <span>{icon}</span>
                        {!compactCollapsed && <span className="truncate">{t(labelKey)}</span>}
                      </Link>
                    )
                  })}
                </nav>
                <div className="mt-auto flex flex-col gap-2 relative" ref={compactProfileMenuRef}>
                  {authenticated && user && (
                    <button
                      type="button"
                      onClick={() => setCompactProfileMenuOpen((prev) => !prev)}
                      className={`flex items-center ${compactCollapsed ? 'justify-center' : 'gap-3'} rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-700 hover:border-brand-primary/60 hover:text-brand-primary transition w-full`}
                      title={t('app.profile.viewProfile')}
                    >
                      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                        {profileAvatar ? (
                          <Image
                            src={profileAvatar}
                            alt={t('app.profile.viewProfile')}
                            width={40}
                            height={40}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          user.email?.charAt(0)?.toUpperCase() || '👤'
                        )}
                      </span>
                      {!compactCollapsed && <span className="truncate">{profileDisplayName}</span>}
                    </button>
                  )}
                  {compactProfileMenuOpen && authenticated && user && (
                    <div
                      className={`absolute z-50 ${compactCollapsed ? 'left-full ml-3 bottom-14' : 'right-0 bottom-14'} w-52 rounded-xl border border-slate-200 bg-white shadow-2xl py-2 text-sm text-slate-700`}
                    >
                      <Link
                        href="/profile"
                        className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50"
                        onClick={() => setCompactProfileMenuOpen(false)}
                      >
                        👤 {t('app.profile.viewProfile')}
                      </Link>
                      <button
                        type="button"
                        onClick={async () => {
                          setCompactProfileMenuOpen(false)
                          await handleLogout()
                        }}
                        className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50"
                      >
                        ⎋ {t('account.actions.logout')}
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setCompactCollapsed((prev) => !prev)}
                    className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-lg font-bold text-slate-600 hover:border-brand-primary/60 hover:text-brand-primary transition"
                    aria-pressed={compactCollapsed}
                    aria-label={compactCollapsed ? t('app.nav.menu') : t('app.nav.close')}
                    title={compactCollapsed ? t('app.nav.menu') : t('app.nav.close')}
                  >
                    {compactCollapsed ? '›' : '‹'}
                  </button>
                </div>
              </aside>

              <main className="relative flex-1 min-h-screen min-h-0 bg-transparent px-3 sm:px-6 py-4 lg:py-6 flex flex-col">
                <div className="lg:hidden absolute left-2 top-2 z-30">
                  <button
                    type="button"
                    onClick={() => setMenuOpen((prev) => !prev)}
                    className="flex h-11 w-11 items-center justify-center rounded-2xl border border-slate-200 bg-white text-xl text-slate-600 shadow-md hover:text-slate-900"
                    aria-expanded={menuOpen}
                    aria-controls="compact-nav"
                    aria-label={menuOpen ? t('app.nav.close') : t('app.nav.menu')}
                  >
                    ☰
                  </button>
                </div>
                <div className="h-full">{children}</div>
              </main>
            </div>

            {authenticated && menuOpen && (
              <div
                id="compact-nav"
                className="fixed inset-y-0 left-0 z-40 w-72 max-w-[80vw] border-r border-slate-200 bg-white shadow-2xl p-4 flex flex-col gap-3 lg:hidden"
              >
                <Link
                  href="/appointments"
                  className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-primary/60 hover:text-brand-primary transition"
                  onClick={() => setMenuOpen(false)}
                >
                  ← <span className="truncate">{t('app.nav.appointments')}</span>
                </Link>
                {availableNavItems.map(({ href, labelKey, icon }) => {
                  const isActive = pathname === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${isActive
                        ? 'border-brand-primary bg-brand-primary text-white shadow-brand-glow'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-brand-primary/60 hover:text-slate-900'
                        }`}
                      onClick={() => setMenuOpen(false)}
                    >
                      <span>{icon}</span>
                      <span className="truncate">{t(labelKey)}</span>
                    </Link>
                  )
                })}
                <button
                  type="button"
                  onClick={() => setMenuOpen(false)}
                  className="mt-auto text-sm font-semibold text-slate-600 hover:text-brand-primary text-left"
                >
                  {t('app.nav.close')}
                </button>
              </div>
            )}

            {menuOpen && (
              <div
                className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
                aria-hidden="true"
                onClick={() => setMenuOpen(false)}
              />
            )}
          </div>
        </AccountGate>
      </div>
    )
  }

  if (isMobile && authenticated && !isPublicRoute) {
    return (
      <AccountGate>
        <AppShellMobile
          account={account}
          t={t}
          profileAvatar={profileAvatar}
          profileDisplayName={profileDisplayName}
          pathname={pathname}
          handleLogout={handleLogout}
          mobileNavItems={mobileItems}
        >
          {children}
        </AppShellMobile>
      </AccountGate>
    )
  }

  return (
    <div className="min-h-screen brand-background">
      <AccountGate>
        <div className="relative flex min-h-screen">
          <div className="flex min-h-screen w-full">
            <aside
              className={`hidden lg:flex ${compactCollapsed ? 'w-16 px-2' : 'w-64 px-4'} shrink-0 flex-col border-r border-slate-200 bg-white/90 backdrop-blur py-5 gap-3 transition-all relative z-30 overflow-visible`}
            >
              <Link
                href="/appointments"
                className={`flex h-16 w-full items-center ${compactCollapsed ? 'justify-center' : 'gap-3'} text-sm font-semibold text-slate-700 hover:text-brand-primary transition`}
                title={t('app.nav.appointments')}
              >
                <div className="h-full w-full flex items-center justify-center">
                  {logoError ? (
                    <span className="text-2xl">🐾</span>
                  ) : (
                    <Image
                      src={account?.logo_url || defaultLogo}
                      alt={t('app.logoAlt', { name: account?.name || t('app.title') })}
                      width={72}
                      height={72}
                      className="h-full w-full object-cover rounded-xl"
                      onError={() => setLogoError(true)}
                    />
                  )}
                </div>
                {!compactCollapsed && (
                  <span className="truncate flex-1 text-left">{account?.name || t('app.title')}</span>
                )}
              </Link>
              <nav className="flex flex-col gap-2">
                {availableNavItems.map(({ href, labelKey, icon }) => {
                  const isActive = pathname === href
                  return (
                    <Link
                      key={href}
                      href={href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`flex items-center ${compactCollapsed ? 'justify-center' : 'gap-2'} rounded-xl border px-3 py-2 text-sm font-semibold transition ${isActive
                        ? 'border-brand-primary bg-brand-primary text-white shadow-brand-glow'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-brand-primary/60 hover:text-slate-900'
                        }`}
                      title={t(labelKey)}
                    >
                      <span>{icon}</span>
                      {!compactCollapsed && <span className="truncate">{t(labelKey)}</span>}
                    </Link>
                  )
                })}
              </nav>
              <div className="mt-auto flex flex-col gap-2 relative" ref={compactProfileMenuRef}>
                {authenticated && user && (
                  <button
                    type="button"
                    onClick={() => setCompactProfileMenuOpen((prev) => !prev)}
                    className={`flex items-center ${compactCollapsed ? 'justify-center' : 'gap-3'} rounded-xl border border-slate-200 bg-white px-2 py-2 text-sm font-semibold text-slate-700 hover:border-brand-primary/60 hover:text-brand-primary transition w-full`}
                    title={t('app.profile.viewProfile')}
                  >
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-100 overflow-hidden border border-slate-200">
                      {profileAvatar ? (
                        <Image
                          src={profileAvatar}
                          alt={t('app.profile.viewProfile')}
                          width={40}
                          height={40}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        user.email?.charAt(0)?.toUpperCase() || '👤'
                      )}
                    </span>
                    {!compactCollapsed && <span className="truncate">{profileDisplayName}</span>}
                  </button>
                )}
                {compactProfileMenuOpen && authenticated && user && (
                  <div
                    className={`absolute z-50 ${compactCollapsed ? 'left-full ml-3 bottom-14' : 'right-0 bottom-14'} w-52 rounded-xl border border-slate-200 bg-white shadow-2xl py-2 text-sm text-slate-700`}
                  >
                    <Link
                      href="/profile"
                      className="flex items-center gap-2 px-3 py-2 hover:bg-slate-50"
                      onClick={() => setCompactProfileMenuOpen(false)}
                    >
                      👤 {t('app.profile.viewProfile')}
                    </Link>
                    <button
                      type="button"
                      onClick={async () => {
                        setCompactProfileMenuOpen(false)
                        await handleLogout()
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-red-600 hover:bg-red-50"
                    >
                      ⎋ {t('account.actions.logout')}
                    </button>
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setCompactCollapsed((prev) => !prev)}
                  className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white px-3 py-2 text-lg font-bold text-slate-600 hover:border-brand-primary/60 hover:text-brand-primary transition"
                  aria-pressed={compactCollapsed}
                  aria-label={compactCollapsed ? t('app.nav.menu') : t('app.nav.close')}
                  title={compactCollapsed ? t('app.nav.menu') : t('app.nav.close')}
                >
                  {compactCollapsed ? '›' : '‹'}
                </button>
              </div>
            </aside>

            <main className="relative flex-1 min-h-screen min-h-0 bg-transparent px-3 sm:px-6 py-4 lg:py-6 flex flex-col">
              <div className="lg:hidden absolute left-2 top-2 z-30" />
              <div className="h-full">{children}</div>
              {authenticated && memberships?.length > 1 && (
                <div className="mt-6 border-t border-slate-100 bg-white/80 px-4 py-3 text-sm text-slate-600 rounded-2xl shadow-sm">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-start">
                    <label className="font-semibold text-xs uppercase tracking-wide text-slate-500">
                      {t('app.tenantSwitch.label')}
                    </label>
                    <select
                      value={membership?.account_id || memberships[0]?.account_id}
                      onChange={(event) => selectAccount(event.target.value)}
                      className="rounded-full border border-slate-300 px-3 py-1 text-sm text-slate-700 focus:border-slate-500 focus:outline-none"
                    >
                      {memberships.map((entry) => (
                        <option key={entry.account_id} value={entry.account_id}>
                          {entry.account?.name || entry.account_id}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}
            </main>
          </div>

          {authenticated && menuOpen && (
            <div
              id="compact-nav"
              className="fixed inset-y-0 left-0 z-40 w-72 max-w-[80vw] border-r border-slate-200 bg-white shadow-2xl p-4 flex flex-col gap-3 lg:hidden"
            >
              {authenticated && user && (
                <div className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3 text-sm font-semibold text-slate-700">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-white overflow-hidden border border-slate-200">
                    {profileAvatar ? (
                      <Image
                        src={profileAvatar}
                        alt={t('app.profile.viewProfile')}
                        width={40}
                        height={40}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      user.email?.charAt(0)?.toUpperCase() || '👤'
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="truncate">{profileDisplayName}</p>
                    <Link
                      href="/profile"
                      className="text-xs font-medium text-brand-primary hover:underline"
                      onClick={() => setMenuOpen(false)}
                    >
                      {t('app.profile.viewProfile')}
                    </Link>
                  </div>
                </div>
              )}
              <Link
                href="/appointments"
                className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 hover:border-brand-primary/60 hover:text-brand-primary transition"
                onClick={() => setMenuOpen(false)}
              >
                ← <span className="truncate">{t('app.nav.appointments')}</span>
              </Link>
              {availableNavItems.map(({ href, labelKey, icon }) => {
                const isActive = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex items-center gap-2 rounded-xl border px-3 py-2 text-sm font-semibold ${isActive
                      ? 'border-brand-primary bg-brand-primary text-white shadow-brand-glow'
                      : 'border-slate-200 bg-white text-slate-600 hover:border-brand-primary/60 hover:text-slate-900'
                      }`}
                    onClick={() => setMenuOpen(false)}
                  >
                    <span>{icon}</span>
                    <span className="truncate">{t(labelKey)}</span>
                  </Link>
                )
              })}
              {authenticated && (
                <button
                  type="button"
                  onClick={async () => {
                    setMenuOpen(false)
                    await handleLogout()
                  }}
                  className="flex items-center justify-center gap-2 rounded-xl border border-red-100 bg-red-50 px-3 py-2 text-sm font-semibold text-red-600 hover:bg-red-100"
                >
                  ⎋ {t('account.actions.logout')}
                </button>
              )}
              <button
                type="button"
                onClick={() => setMenuOpen(false)}
                className="mt-auto text-sm font-semibold text-slate-600 hover:text-brand-primary text-left"
              >
                {t('app.nav.close')}
              </button>
            </div>
          )}

          {menuOpen && (
            <div
              className="fixed inset-0 z-30 bg-black/30 backdrop-blur-sm lg:hidden"
              aria-hidden="true"
              onClick={() => setMenuOpen(false)}
            />
          )}
        </div>

        {!isPublicRoute && (
          <></>
        )}

        {authenticated && !isPublicRoute && (
          <nav
            className="fixed bottom-0 left-0 right-0 z-40 border-t border-slate-200 bg-white/95 px-2 py-2 shadow-[0_-6px_18px_rgba(15,23,42,0.08)] backdrop-blur md:hidden"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 0.5rem)' }}
          >
            <div className="mx-auto flex max-w-7xl items-center justify-around gap-1">
              {availableNavItems.map(({ href, labelKey, icon }) => {
                const isActive = pathname === href
                return (
                  <Link
                    key={href}
                    href={href}
                    aria-current={isActive ? 'page' : undefined}
                    className={`flex flex-1 flex-col items-center gap-1 rounded-xl px-2 py-2 text-xs font-semibold transition ${isActive
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
        )}
      </AccountGate>
    </div>
  )
}
