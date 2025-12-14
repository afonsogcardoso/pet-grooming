'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'

const baseLinkClasses =
  'flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold transition-colors duration-150'

export default function AdminSidebar({ navItems }) {
  const pathname = usePathname()

  return (
    <aside className="bg-slate-950 text-slate-100 w-full md:w-72 md:max-w-xs md:min-h-screen border-b border-slate-900 md:border-b-0 md:border-r">
      <div className="px-5 py-4 border-b border-white/10">
        <p className="text-xs uppercase tracking-[0.2em] text-slate-400">Platform</p>
        <p className="text-xl font-semibold">Admin Console</p>
        <p className="text-sm text-slate-400 mt-1">Internal controls &amp; observability</p>
      </div>
      <nav className="flex md:flex-col overflow-x-auto md:overflow-x-visible px-3 py-2 gap-2">
        {navItems.map((item) => {
          const isOverview = item.href === '/admin'
          const isActive = isOverview ? pathname === item.href : pathname.startsWith(item.href)
          const classes = isActive
            ? `${baseLinkClasses} bg-slate-800 text-white shadow-lg shadow-slate-900/30`
            : `${baseLinkClasses} text-slate-300 hover:bg-slate-900`

          return (
            <Link key={item.href} href={item.href} className={classes}>
              <span className="text-lg" aria-hidden>
                {item.icon}
              </span>
              <div className="flex flex-col leading-tight">
                <span>{item.label}</span>
                <span className="text-xs font-normal text-slate-400">{item.description}</span>
              </div>
            </Link>
          )
        })}
      </nav>
    </aside>
  )
}
