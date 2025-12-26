import Link from 'next/link'
import styles from '../marketplace/marketplace.module.css'
import MarketplaceTopNav from '../marketplace/MarketplaceTopNav'

export const metadata = {
  title: 'Planos Pawmi',
  description: 'Planos Pawmi para prestadores com subscrição mensal e sem comissões.'
}

const pricingPlans = [
  {
    name: 'Starter',
    price: '€0',
    period: '/mês',
    description: 'Para começar a testar o marketplace.',
    features: ['Página pública no marketplace', 'Pedidos básicos', 'Suporte por email'],
    cta: 'Começar'
  },
  {
    name: 'Pro',
    price: '€39',
    period: '/mês',
    description: 'Mais visibilidade e gestão completa.',
    features: [
      'Listagem com destaque',
      'Pedidos ilimitados',
      'App de gestão incluída',
      'Notificações em tempo real'
    ],
    highlight: true,
    cta: 'Subscrever Pro'
  },
  {
    name: 'Scale',
    price: '€79',
    period: '/mês',
    description: 'Para equipas e múltiplas localizações.',
    features: ['Multi-unidades', 'Relatórios avançados', 'Suporte prioritário'],
    cta: 'Falar com a equipa'
  }
]

const planBenefits = [
  {
    title: 'Sem comissões',
    description: 'Pagamentos diretos entre cliente e prestador, sem percentagens.'
  },
  {
    title: 'Gestão integrada',
    description: 'App de gestão com agenda, pedidos e comunicação num só lugar.'
  },
  {
    title: 'Mais visibilidade',
    description: 'Destaque no marketplace com foco em contas verificadas.'
  }
]

const faqs = [
  {
    question: 'Existe fidelização mínima?',
    answer: 'Não. Podes cancelar ou mudar de plano quando precisares.'
  },
  {
    question: 'O plano Starter é sempre grátis?',
    answer: 'Sim. É uma forma de testar o marketplace com funcionalidades essenciais.'
  },
  {
    question: 'Como funciona o pagamento?',
    answer: 'Subscrição mensal automática com fatura, sem comissões por marcação.'
  }
]

export default function PlanosPage() {
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
                  Planos Pawmi
                </p>
                <h1
                  className={`${styles.stagger} text-4xl font-bold leading-tight text-slate-900 sm:text-5xl`}
                  style={{ '--delay': '80ms' }}
                >
                  Subscrições flexíveis para contas que querem crescer.
                </h1>
                <p
                  className={`${styles.stagger} max-w-xl text-sm leading-relaxed text-slate-600 sm:text-[15px]`}
                  style={{ '--delay': '160ms' }}
                >
                  Escolhe o plano certo para o teu estúdio e garante visibilidade no marketplace, gestão
                  simples e clientes com pedidos reais.
                </p>
                <div
                  className={`${styles.stagger} flex flex-col gap-3 sm:flex-row`}
                  style={{ '--delay': '240ms' }}
                >
                  <Link href="#planos" className="btn-brand px-6 py-3 text-sm shadow-brand-glow">
                    Comparar planos
                  </Link>
                  <Link href="/login" className="btn-brand-outlined px-6 py-3 text-sm">
                    Falar com a equipa
                  </Link>
                </div>
              </div>

              <div className={`${styles.glassCard} rounded-3xl p-6`}>
                <p className="text-[11px] font-semibold uppercase tracking-[0.3em] text-brand-primary">
                  Inclui sempre
                </p>
                <h2 className="mt-3 text-xl font-semibold text-slate-900">
                  Tudo o que precisas para operar sem fricção.
                </h2>
                <div className="mt-4 flex flex-col gap-3 text-sm text-slate-600">
                  {[
                    'Página pública otimizada para descoberta',
                    'Pedidos centralizados e resposta rápida',
                    'Suporte humano em português'
                  ].map((item) => (
                    <div key={item} className="flex items-start gap-3">
                      <span className="mt-1 h-2 w-2 rounded-full bg-brand-primary" />
                      <span>{item}</span>
                    </div>
                  ))}
                </div>
                <div className="mt-6 rounded-2xl bg-brand-primary-soft px-4 py-3 text-xs font-semibold text-brand-primary">
                  Sem comissões por marcação. Pagas apenas a subscrição escolhida.
                </div>
              </div>
            </div>
          </div>
        </header>

        <section id="planos" className="px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-primary">
                  Planos para prestadores
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                  Subscrição mensal, sem comissões.
                </h2>
                <p className="mt-3 text-sm text-slate-600">
                  A subscrição ativa a visibilidade no marketplace e o acesso à plataforma de gestão.
                </p>
              </div>
              <Link href="/login" className="text-sm font-semibold text-brand-primary">
                Juntar conta
              </Link>
            </div>
            <div className="mt-8 grid gap-4 md:grid-cols-3">
              {pricingPlans.map((plan, index) => (
                <div
                  key={plan.name}
                  className={`${styles.stagger} rounded-2xl border ${
                    plan.highlight
                      ? 'border-brand-primary bg-white shadow-brand-glow'
                      : 'border-slate-200 bg-white'
                  } p-6 shadow-sm`}
                  style={{ '--delay': `${index * 100}ms` }}
                >
                  <div className="flex items-center justify-between">
                    <p className="text-lg font-semibold text-slate-900">{plan.name}</p>
                    {plan.highlight && (
                      <span className="rounded-full bg-brand-primary-soft px-3 py-1 text-[11px] font-semibold text-brand-primary">
                        Mais escolhido
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-slate-900">{plan.price}</span>
                    <span className="text-sm text-slate-500">{plan.period}</span>
                  </div>
                  <p className="mt-3 text-sm text-slate-600">{plan.description}</p>
                  <div className="mt-4 flex flex-col gap-2 text-xs font-semibold text-slate-600">
                    {plan.features.map((feature) => (
                      <span key={feature} className="rounded-full bg-slate-100 px-3 py-2">
                        {feature}
                      </span>
                    ))}
                  </div>
                  <Link
                    href="/login"
                    className={`mt-5 inline-flex w-full items-center justify-center rounded-full px-4 py-2 text-sm font-semibold ${
                      plan.highlight
                        ? 'bg-brand-primary text-white shadow-brand-glow'
                        : 'border border-slate-200 text-slate-700'
                    }`}
                  >
                    {plan.cta}
                  </Link>
                </div>
              ))}
            </div>
            <p className="mt-5 text-xs text-slate-500">
              Sem comissões por marcação. Pagamento tratado diretamente entre cliente e prestador.
            </p>
          </div>
        </section>

        <section id="beneficios" className="px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-primary">
                Benefícios
              </p>
              <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                Tudo alinhado para o teu negócio crescer.
              </h2>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {planBenefits.map((benefit, index) => (
                <div
                  key={benefit.title}
                  className={`${styles.stagger} rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm`}
                  style={{ '--delay': `${index * 90}ms` }}
                >
                  <p className="text-lg font-semibold text-slate-900">{benefit.title}</p>
                  <p className="mt-2 text-sm text-slate-600">{benefit.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="faq" className="px-6 py-12">
          <div className="mx-auto max-w-6xl">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-brand-primary">
                  Perguntas frequentes
                </p>
                <h2 className="mt-2 text-2xl font-bold text-slate-900 sm:text-3xl">
                  Tudo esclarecido antes de aderires.
                </h2>
              </div>
              <Link href="/login" className="text-sm font-semibold text-brand-primary">
                Falar com a equipa
              </Link>
            </div>
            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {faqs.map((item, index) => (
                <div
                  key={item.question}
                  className={`${styles.stagger} rounded-2xl border border-white/70 bg-white/80 p-5 shadow-sm`}
                  style={{ '--delay': `${index * 90}ms` }}
                >
                  <p className="text-sm font-semibold text-slate-900">{item.question}</p>
                  <p className="mt-2 text-sm text-slate-600">{item.answer}</p>
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
                    Pronto para começar?
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
                    href="/marketplace"
                    className="rounded-full border border-white/70 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
                  >
                    Ver marketplace
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
