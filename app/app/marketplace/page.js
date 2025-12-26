import Image from 'next/image'
import Link from 'next/link'
import { getMarketplaceAccounts } from '@/lib/marketplace'
import { formatPhoneDisplay } from '@/lib/phone'
import MarketplaceTopNav from './MarketplaceTopNav'
import styles from './marketplace.module.css'

export const metadata = {
  title: 'Marketplace Pawmi',
  description:
    'Marketplace Pawmi para pet grooming, pet sitting, veterinário, treino de cães e bem-estar animal.'
}

const categories = [
  {
    title: 'Pet grooming',
    description: 'Banho, tosquia e estética especializada.',
    stats: '72 contas'
  },
  {
    title: 'Pet sitting',
    description: 'Acompanhamento em casa ou hotel.',
    stats: '44 contas'
  },
  {
    title: 'Serviços veterinários',
    description: 'Consultas, vacinação e check-ups.',
    stats: '28 contas'
  },
  {
    title: 'Treino de cães',
    description: 'Obediência, socialização e comportamento.',
    stats: '31 contas'
  },
  {
    title: 'Bem-estar animal',
    description: 'Spa, fisioterapia e terapias.',
    stats: '19 contas'
  },
  {
    title: 'Novas categorias',
    description: 'Estamos a abrir para novos serviços.',
    stats: 'Em expansão'
  }
]

const highlights = [
  {
    title: 'Contas verificadas',
    description: 'Registo validado e avaliações reais.',
    badge: 'Verificado'
  },
  {
    title: 'Sem comissões',
    description: 'Subscrição mensal, sem percentagens por marcação.',
    badge: 'Transparente'
  },
  {
    title: 'App de gestão incluída',
    description: 'Pedidos entram direto na plataforma de gestão.',
    badge: 'Integrado'
  }
]

function normalizeSearchParam(value) {
  if (Array.isArray(value)) return value[0] || ''
  if (typeof value === 'string') return value.trim()
  return ''
}

const steps = [
  {
    title: 'Descobre contas Pawmi',
    description: 'Filtra por cidade, categoria e disponibilidade.'
  },
  {
    title: 'Faz o pedido',
    description: 'Envia a marcação e aguarda a confirmação.'
  },
  {
    title: 'Gestão sem fricção',
    description: 'O prestador recebe o pedido na app de gestão.'
  }
]

const stats = [
  { value: '180+', label: 'contas Pawmi ativas' },
  { value: '1.6K+', label: 'reservas mensais' },
  { value: '35', label: 'cidades' },
  { value: '4.9/5', label: 'rating médio' }
]

export default async function MarketplacePage({ searchParams }) {
  const searchQuery = normalizeSearchParam(searchParams?.q)
  const categoryFilter = normalizeSearchParam(searchParams?.category)
  const providers = await getMarketplaceAccounts(searchQuery, categoryFilter, 24, 0)

  return (
    <div className={`${styles.page} ${styles.pawmiTheme} min-h-screen`}>
      <div className="relative z-10">
        <header className="px-6 pb-14 pt-10 lg:pt-14">
          <div className="mx-auto flex max-w-6xl flex-col gap-12">
            <MarketplaceTopNav />

            <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
              <div className="flex flex-col gap-6">
                <p
                  className={`${styles.stagger} text-sm font-semibold uppercase tracking-[0.35em] text-brand-primary`}
                  style={{ '--delay': '0ms' }}
                >
                  Marketplace Pawmi
                </p>
                <h1
                  className={`${styles.stagger} text-4xl font-bold leading-tight text-slate-900 sm:text-5xl lg:text-6xl`}
                  style={{ '--delay': '80ms' }}
                >
                  As melhores contas de grooming e bem-estar para o teu pet.
                </h1>
                <p
                  className={`${styles.stagger} max-w-xl text-sm leading-relaxed text-slate-600 sm:text-[15px]`}
                  style={{ '--delay': '160ms' }}
                >
                  O marketplace Pawmi lista as contas que se juntam à plataforma. Encontra grooming,
                  pet sitting, serviços veterinários, treino de cães e bem-estar animal com
                  disponibilidade real.
                </p>
                <div
                  className={`${styles.stagger} flex flex-col gap-3 sm:flex-row`}
                  style={{ '--delay': '240ms' }}
                >
                  <Link
                    href="#destaques"
                    className="btn-brand px-6 py-3 text-sm shadow-brand-glow"
                  >
                    Explorar contas
                  </Link>
                  <Link href="/planos" className="btn-brand-outlined px-6 py-3 text-sm">
                    Ver planos
                  </Link>
                </div>
                <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                  {stats.map((stat, index) => (
                    <div
                      key={stat.label}
                      className={`${styles.stagger} rounded-2xl border border-white/70 bg-white/80 px-4 py-3 text-center text-slate-700 shadow-sm`}
                      style={{ '--delay': `${320 + index * 80}ms` }}
                    >
                      <p className="text-lg font-semibold text-slate-900">{stat.value}</p>
                      <p className="text-[11px] uppercase tracking-[0.2em] text-slate-500">
                        {stat.label}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="relative">
                <div className={`${styles.glassCard} rounded-3xl p-6`}>
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-primary">
                      Pesquisa rápida
                    </p>
                    <span className="rounded-full bg-brand-primary-soft px-3 py-1 text-[11px] font-semibold text-brand-primary">
                      Novo
                    </span>
                  </div>
                  <h2 className="mt-3 text-xl font-semibold text-slate-900">
                    Encontra contas Pawmi e faz pedidos em minutos.
                  </h2>
                  <form className="mt-4 flex flex-col gap-3 sm:flex-row" action="/marketplace">
                    <input
                      type="text"
                      name="q"
                      placeholder="Cidade, região ou conta"
                      className="flex-1 rounded-full border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 placeholder:text-slate-400 shadow-sm focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20"
                    />
                    <button
                      type="submit"
                      className="btn-brand px-5 py-3 text-sm shadow-brand-glow"
                    >
                      Pesquisar
                    </button>
                  </form>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-500">
                    {['Lisboa', 'Porto', 'Novas contas', 'Verificadas', 'Pet sitting'].map((item) => (
                      <span
                        key={item}
                        className="rounded-full border border-slate-200 bg-white px-3 py-1"
                      >
                      {item}
                      </span>
                    ))}
                  </div>
                </div>

                <div
                  className={`${styles.stagger} mt-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-lg`}
                  style={{ '--delay': '200ms' }}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Studio Pêlo Feliz</p>
                      <p className="text-xs text-slate-500">Lisboa · Conta verificada</p>
                    </div>
                    <div className="rounded-full bg-brand-primary-soft px-3 py-1 text-xs font-semibold text-brand-primary">
                      Conta destaque
                    </div>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                    <div>
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">
                        Rating Pawmi
                      </p>
                      <p className="text-lg font-semibold text-slate-900">4.9</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs uppercase tracking-[0.2em] text-slate-400">desde</p>
                      <p className="text-lg font-semibold text-slate-900">€24</p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                    {['Banho premium', 'Hidratação', 'Recolha'].map((tag) => (
                      <span key={tag} className="rounded-full bg-slate-100 px-3 py-1">
                        {tag}
                      </span>
                    ))}
                  </div>
                </div>

                <div className={`${styles.float} pointer-events-none absolute -right-4 top-10 hidden lg:block`}>
                  <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 text-xs font-semibold text-slate-700 shadow-lg">
                    Novas contas esta semana
                  </div>
                </div>
                <div className={`${styles.float} pointer-events-none absolute -left-6 bottom-8 hidden lg:block`}>
                  <div className="rounded-2xl border border-white/70 bg-white/90 px-4 py-3 text-xs font-semibold text-slate-700 shadow-lg">
                    Média de resposta 32h
                  </div>
                </div>
              </div>
            </div>
          </div>
        </header>

        <section id="categorias" className="px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-primary">
                  Categorias iniciais
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                  Foco inicial com margem para novas áreas.
                </h2>
              </div>
              <Link href="#destaques" className="text-sm font-semibold text-brand-primary">
                Ver contas
              </Link>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-2 md:grid-cols-3">
              {categories.map((category, index) => (
                <div
                  key={category.title}
                  className={`${styles.stagger} rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm`}
                  style={{ '--delay': `${index * 90}ms` }}
                >
                  <p className="text-lg font-semibold text-slate-900">{category.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{category.description}</p>
                  <p className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-brand-primary">
                    {category.stats}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="destaques" className="px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-primary">
                  Contas em destaque
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                  Uma curadoria jovem com foco em confiança.
                </h2>
                <p className="mt-3 text-sm text-slate-600">
                  Selecionamos contas com histórico consistente, ambientes modernos e atendimento
                  cuidado para garantir experiências sem stress.
                </p>
              </div>
              <div className="grid gap-4 sm:grid-cols-3">
                {highlights.map((item, index) => (
                  <div
                    key={item.title}
                    className={`${styles.stagger} rounded-2xl border border-white/70 bg-white/80 p-4 shadow-sm`}
                    style={{ '--delay': `${index * 100}ms` }}
                  >
                    <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-primary">
                      {item.badge}
                    </p>
                    <p className="mt-2 text-[15px] font-semibold text-slate-900">{item.title}</p>
                    <p className="mt-2 text-sm text-slate-600">{item.description}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {providers.length > 0 ? (
                providers.map((provider, index) => {
                  const tags = Array.isArray(provider.marketplace_categories)
                    ? provider.marketplace_categories.filter(Boolean)
                    : []
                  const supportLine =
                    formatPhoneDisplay(provider.support_phone) || provider.support_email
                  const region = provider.marketplace_region
                  const description =
                    provider.marketplace_description || 'Conta Pawmi disponível para novos pedidos.'
                  const providerSlug = provider.slug || ''

                  return (
                    <div
                      key={provider.id || provider.slug || index}
                      className={`${styles.stagger} rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:-translate-y-1 hover:shadow-lg`}
                      style={{ '--delay': `${index * 90}ms` }}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{provider.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{description}</p>
                          {region && (
                            <p className="mt-1 text-xs font-semibold text-slate-500">
                              {region}
                            </p>
                          )}
                        </div>
                        {provider.logo_url ? (
                          <Image
                            src={provider.logo_url}
                            alt={`Logo ${provider.name}`}
                            width={40}
                            height={40}
                            className="h-10 w-10 rounded-xl object-cover border border-slate-200 bg-white"
                          />
                        ) : (
                          <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                            Pawmi
                          </div>
                        )}
                      </div>
                      {supportLine && (
                        <p className="mt-2 text-xs text-slate-500">{supportLine}</p>
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
                      <Link
                        href={providerSlug ? `/marketplace/${providerSlug}` : '/marketplace'}
                        className="mt-4 inline-flex text-xs font-semibold text-brand-primary hover:underline"
                      >
                        Ver conta
                      </Link>
                    </div>
                  )
                })
              ) : (
                <div className="col-span-full rounded-2xl border border-dashed border-slate-200 bg-white/70 p-6 text-center text-sm text-slate-600">
                  Ainda não existem prestadores ativos no marketplace.
                </div>
              )}
            </div>
          </div>
        </section>

        <section id="como-funciona" className="px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-primary">
                  Como funciona
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                  Reserva fluida do início ao fim.
                </h2>
              </div>
              <Link href="/login" className="text-sm font-semibold text-brand-primary">
                Criar conta
              </Link>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {steps.map((step, index) => (
                <div
                  key={step.title}
                  className={`${styles.stagger} rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm`}
                  style={{ '--delay': `${index * 100}ms` }}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-primary text-sm font-semibold text-white shadow-brand-glow">
                      0{index + 1}
                    </span>
                    <p className="text-[15px] font-semibold text-slate-900">{step.title}</p>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>


        <section className="px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <div className={`${styles.ctaPanel} rounded-3xl p-8 text-white shadow-2xl`}>
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr] lg:items-center">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.3em] text-white/80">
                    Para contas Pawmi
                  </p>
                  <h2 className="mt-3 text-3xl font-bold">
                    A tua conta Pawmi com mais visibilidade.
                  </h2>
                  <p className="mt-3 text-sm text-white/90">
                    Cria o teu perfil, gere disponibilidade e recebe clientes que valorizam um
                    atendimento premium. Nós cuidamos da descoberta e da gestão via subscrição.
                  </p>
                </div>
                <div className="flex flex-col gap-3 sm:flex-row lg:justify-end">
                  <Link
                    href="/login"
                    className="rounded-full bg-white px-6 py-3 text-sm font-semibold text-slate-900 shadow-lg transition hover:-translate-y-0.5"
                  >
                    Juntar a minha conta
                  </Link>
                  <Link
                    href="/login"
                    className="rounded-full border border-white/70 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Falar com a equipa
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
