import { ChevronRight, Crown, Gift, Lock, Medal, MessageCircle, Radio, ShoppingBag, Trophy, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { useAnglerName } from '../components/bits'
import { SchematicMap } from '../components/SchematicMap'
import { cx, DemoTag } from '../components/ui'
import { brand } from '../config/brand'
import { EVENTS } from '../data/events'
import { diffDays } from '../lib/dates'
import { relativeDay } from '../lib/format'
import { countEntries, currentPeriod, daysLeft } from '../lib/giveaway'
import { reportToPing } from '../lib/pings'
import { addDaysISO } from '../lib/dates'
import { useApp } from '../state/AppState'

function HubCard({ to, icon: Icon, title, text, meta, tone = 'light', children, className }: { to: string; icon: LucideIcon; title: string; text: string; meta?: ReactNode; tone?: 'light' | 'dark'; children?: ReactNode; className?: string }) {
  const dark = tone === 'dark'
  return (
    <Link to={to} className={cx('press group flex flex-col overflow-hidden rounded-[var(--radius-card)] shadow-card hover:shadow-lift', dark ? 'bg-ink text-white' : 'bg-white text-ink', className)}>
      {children}
      <div className="flex items-start gap-3 p-4">
        <span className={cx('grid h-11 w-11 shrink-0 place-items-center rounded-2xl', dark ? 'bg-white/10 text-teal' : 'bg-teal-50 text-teal-700')}>
          <Icon className="h-5 w-5" aria-hidden />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[16px] font-extrabold">{title}</span>
          <span className={cx('mt-0.5 block text-[13px] leading-snug', dark ? 'text-white/65' : 'text-muted')}>{text}</span>
          {meta && <span className="mt-2 block">{meta}</span>}
        </span>
        <ChevronRight className={cx('mt-1 h-5 w-5 shrink-0 transition group-hover:translate-x-0.5', dark ? 'text-white/50' : 'text-subtle')} aria-hidden />
      </div>
    </Link>
  )
}

export default function Community() {
  const { state, allReports, allListings, allMessages } = useApp()
  const anglerName = useAnglerName()
  const recent = allReports.filter((r) => { const a = diffDays(state.anchor, r.date); return a >= 0 && a <= 7 })
  const lastMsg = allMessages[allMessages.length - 1]
  const period = currentPeriod(state.anchor)
  const entries = countEntries(period, state.myCatches, state.myReports, state.subscription.active)
  const nextEvent = [...EVENTS].filter((e) => e.dayOffset >= 0).sort((a, b) => a.dayOffset - b.dayOffset)[0]
  const available = allListings.filter((l) => !l.sold).length

  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-8">
      <header className="pt-safe pt-5 lg:pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-teal-700">Comunidade</p>
          <DemoTag />
        </div>
        <h1 className="font-display mt-1 text-[30px] font-semibold leading-tight text-ink sm:text-[36px]">Pescadores de Portugal e Espanha</h1>
        <p className="mt-1 text-[13.5px] text-muted">Reports, chat, marketplace, provas e giveaway. Perfis e conteúdos de terceiros são fictícios.</p>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-3">
        <HubCard
          to="/reports"
          icon={Radio}
          title="Reports e mapa de pings"
          text="Onde há atividade agora, reportada por quem está na água."
          meta={<span className="text-[12.5px] font-bold text-teal-700">{recent.length} reports nos últimos 7 dias</span>}
          className="lg:col-span-2 lg:row-span-2"
        >
          <div className="pointer-events-none relative">
            <SchematicMap dams={[]} view="iberia" pings={recent.map((r) => reportToPing(r, state.anchor))} className="aspect-[330/262] w-full rounded-none" />
          </div>
        </HubCard>
        <HubCard
          to="/comunidade/chat"
          icon={MessageCircle}
          tone="dark"
          title="Chat global"
          text={state.subscription.active && lastMsg ? `${anglerName(lastMsg.anglerId)}: ${lastMsg.text.slice(0, 70)}${lastMsg.text.length > 70 ? '…' : ''}` : 'Conversa em tempo real entre subscritores.'}
          meta={
            state.subscription.active ? (
              <span className="inline-flex items-center gap-1 text-[12px] font-extrabold text-amber"><Crown className="h-3.5 w-3.5" aria-hidden /> {brand.subscription.name} ativo</span>
            ) : (
              <span className="inline-flex items-center gap-1 text-[12px] font-extrabold text-amber"><Lock className="h-3.5 w-3.5" aria-hidden /> Só subscritores</span>
            )
          }
        />
        <HubCard to="/giveaway" icon={Gift} title={`Giveaway ${brand.giveaway.frequency}`} text={brand.giveaway.prize} meta={<span className="tnum text-[12.5px] font-bold text-teal-700">Faltam {daysLeft(period, state.anchor)} dias · {entries.total} participações tuas</span>} />
        <HubCard to="/mercado" icon={ShoppingBag} title="Marketplace" text="Compra e venda de material entre pescadores." meta={<span className="tnum text-[12.5px] font-bold text-teal-700">{available} anúncios disponíveis</span>} />
        <HubCard
          to="/provas"
          icon={Trophy}
          title="Provas"
          text="Calendário e resultados."
          meta={nextEvent && <span className="text-[12.5px] font-bold text-teal-700">Próxima: {nextEvent.title} · {relativeDay(addDaysISO(state.anchor, nextEvent.dayOffset), state.anchor)}</span>}
        />
        <HubCard to="/rankings" icon={Medal} title="Rankings" text="Classificação comunitária por espécie, barragem e período." />
      </div>
    </div>
  )
}
