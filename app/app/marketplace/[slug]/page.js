import Image from 'next/image'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import styles from '../marketplace.module.css'
import {
  getMarketplaceAccountBySlug,
  getMarketplaceServicesBySlug
} from '@/lib/marketplace'
import { formatPhoneDisplay } from '@/lib/phone'
import MarketplaceTopNav from '../MarketplaceTopNav'

export async function generateMetadata({ params }) {
  const account = await getMarketplaceAccountBySlug(params?.slug)
  if (!account) {
    return {
      title: 'Prestador não encontrado · Marketplace Pawmi'
    }
  }

  return {
    title: `${account.name} · Marketplace Pawmi`,
    description:
      account.marketplace_description ||
      'Conhece este prestador Pawmi e os serviços disponíveis no marketplace.'
  }
}

function formatPrice(value) {
  if (value == null || value === '') return 'Sob consulta'
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return 'Sob consulta'
  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR'
  }).format(numeric)
}

function formatDuration(value) {
  if (!value) return null
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return null
  return `${numeric} min`
}

function buildServiceTags(service) {
  return [
    service.category,
    service.subcategory,
    service.pet_type,
    service.pricing_model
  ]
    .map((item) => (typeof item === 'string' ? item.trim() : ''))
    .filter(Boolean)
}

export default async function MarketplaceProviderPage({ params }) {
  const slug = params?.slug
  const account = await getMarketplaceAccountBySlug(slug)

  if (!account) {
    notFound()
  }

  const services = await getMarketplaceServicesBySlug(slug)
  const categories = Array.isArray(account.marketplace_categories)
    ? account.marketplace_categories.filter(Boolean)
    : []
  const description =
    account.marketplace_description ||
    'Conta Pawmi com serviços dedicados e pedidos tratados pela plataforma.'
  const heroImage = account.portal_image_url || account.logo_url || null
  const supportPhone = formatPhoneDisplay(account.support_phone)
  const contactItems = [
    { label: 'Email', value: account.support_email },
    { label: 'Telefone', value: supportPhone }
  ].filter((item) => item.value)

  return (
    <div className={`${styles.page} ${styles.pawmiTheme} min-h-screen`}>
      <div className="relative z-10">
        <header className="px-6 pb-12 pt-10 lg:pt-14">
          <div className="mx-auto flex max-w-6xl flex-col gap-12">
            <MarketplaceTopNav />

            <div className="grid gap-10 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="flex flex-col gap-6">
                <p
                  className={`${styles.stagger} text-sm font-semibold uppercase tracking-[0.35em] text-brand-primary`}
                  style={{ '--delay': '0ms' }}
                >
                  {account.name}
                </p>
                <h1
                  className={`${styles.stagger} text-4xl font-bold leading-tight text-slate-900 sm:text-5xl`}
                  style={{ '--delay': '80ms' }}
                >
                  Serviços disponíveis no marketplace Pawmi.
                </h1>
                <p
                  className={`${styles.stagger} max-w-xl text-sm leading-relaxed text-slate-600 sm:text-[15px]`}
                  style={{ '--delay': '160ms' }}
                >
                  {description}
                </p>
                {categories.length > 0 && (
                  <div
                    className={`${styles.stagger} flex flex-wrap gap-2`}
                    style={{ '--delay': '220ms' }}
                  >
                    {categories.map((category) => (
                      <span
                        key={category}
                        className="rounded-full bg-brand-primary-soft px-4 py-2 text-xs font-semibold text-brand-primary"
                      >
                        {category}
                      </span>
                    ))}
                  </div>
                )}
                <div
                  className={`${styles.stagger} flex flex-col gap-3 sm:flex-row`}
                  style={{ '--delay': '280ms' }}
                >
                  <Link href="#servicos" className="btn-brand px-6 py-3 text-sm shadow-brand-glow">
                    Ver serviços
                  </Link>
                  <Link href="/login" className="btn-brand-outlined px-6 py-3 text-sm">
                    Fazer pedido
                  </Link>
                </div>
              </div>

              <div className={`${styles.glassCard} rounded-3xl p-6`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-primary">
                  Perfil Pawmi
                </p>
                <h2 className="mt-3 text-xl font-semibold text-slate-900">
                  Informação pública do prestador.
                </h2>
                {heroImage ? (
                  <Image
                    src={heroImage}
                    alt={account.name}
                    width={520}
                    height={320}
                    className="mt-4 h-40 w-full rounded-2xl object-cover"
                  />
                ) : (
                  <div className="mt-4 flex h-40 items-center justify-center rounded-2xl border border-dashed border-slate-200 bg-white text-sm text-slate-500">
                    Sem imagem pública disponível
                  </div>
                )}
                <div className="mt-5 flex flex-col gap-2 text-sm text-slate-600">
                  {contactItems.length > 0 ? (
                    contactItems.map((item) => (
                      <div key={item.label} className="flex items-center justify-between gap-3">
                        <span className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                          {item.label}
                        </span>
                        <span className="text-right text-sm font-semibold text-slate-900">
                          {item.value}
                        </span>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-slate-500">
                      Contactos disponíveis após pedido no marketplace.
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>
        </header>

        <section id="servicos" className="px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-primary">
                  Serviços disponíveis
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                  Escolhe o serviço certo para o teu pet.
                </h2>
              </div>
              <Link href="/login" className="text-sm font-semibold text-brand-primary">
                Fazer pedido
              </Link>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {services.length > 0 ? (
                services.map((service, index) => {
                  const duration = formatDuration(service.default_duration)
                  const tags = buildServiceTags(service)
                  return (
                    <div
                      key={service.id}
                      className={`${styles.stagger} rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm`}
                      style={{ '--delay': `${index * 90}ms` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-[15px] font-semibold text-slate-900">{service.name}</p>
                          {service.description && (
                            <p className="mt-2 text-sm text-slate-600">{service.description}</p>
                          )}
                        </div>
                        <span className="rounded-full bg-brand-primary-soft px-3 py-1 text-xs font-semibold text-brand-primary">
                          {formatPrice(service.price)}
                        </span>
                      </div>
                      {duration && (
                        <p className="mt-3 text-xs uppercase tracking-[0.2em] text-slate-400">
                          {duration}
                        </p>
                      )}
                      {tags.length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                          {tags.slice(0, 4).map((tag) => (
                            <span key={tag} className="rounded-full bg-slate-100 px-3 py-1">
                              {tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })
              ) : (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-600">
                  Este prestador ainda não publicou serviços no marketplace.
                </div>
              )}
            </div>
          </div>
        </section>

        <section className="px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <div className={`${styles.ctaPanel} rounded-3xl p-8 text-white shadow-2xl`}>
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                    Queres avançar?
                  </p>
                  <h2 className="mt-3 text-3xl font-bold">
                    Faz um pedido e garante a disponibilidade.
                  </h2>
                  <p className="mt-3 text-sm text-white/90">
                    O pedido entra diretamente na conta {account.name} e a confirmação chega via
                    plataforma Pawmi.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                  <Link
                    href="/login"
                    className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:-translate-y-0.5"
                  >
                    Pedir marcação
                  </Link>
                  <Link
                    href="/marketplace"
                    className="rounded-full border border-white/70 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Ver mais prestadores
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  )
}
