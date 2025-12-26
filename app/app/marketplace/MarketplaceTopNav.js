import Image from 'next/image'
import Link from 'next/link'

export default function MarketplaceTopNav() {
  return (
    <nav className="flex flex-wrap items-center justify-between gap-6">
      <Link href="/marketplace" className="flex items-center gap-3">
        <Image
          src="/brand-logo.png"
          alt="Pawmi logo"
          width={56}
          height={56}
          className="h-14 w-14 rounded-2xl object-cover bg-white/80 shadow-brand-glow"
          priority
        />
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-primary">
            Pawmi
          </p>
          <p className="text-lg font-semibold text-slate-900">Marketplace</p>
        </div>
      </Link>
      <div className="hidden items-center gap-6 text-sm font-semibold text-slate-600 md:flex">
        <Link href="/marketplace#categorias" className="transition hover:text-brand-primary">
          Categorias
        </Link>
        <Link href="/marketplace#destaques" className="transition hover:text-brand-primary">
          Destaques
        </Link>
        <Link href="/marketplace#como-funciona" className="transition hover:text-brand-primary">
          Como funciona
        </Link>
        <Link href="/planos" className="transition hover:text-brand-primary">
          Planos
        </Link>
      </div>
      <div className="flex items-center gap-2">
        <Link href="/login" className="btn-brand-outlined px-4 py-2 text-sm">
          Entrar
        </Link>
        <Link href="/login" className="btn-brand px-4 py-2 text-sm shadow-brand-glow">
          Juntar conta
        </Link>
      </div>
    </nav>
  )
}
