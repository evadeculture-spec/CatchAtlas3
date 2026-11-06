import { CalendarClock, Check, Fish, Gift, Info, Radio, Trophy } from 'lucide-react'
import { Avatar, useAnglerName } from '../components/bits'
import { Button, ButtonLink, Card, PageHeader, Tag } from '../components/ui'
import { brand } from '../config/brand'
import { DEMO_USER_ID } from '../data/anglers'
import { addDaysISO, toISODate } from '../lib/dates'
import { capFirst, formatDate } from '../lib/format'
import { countEntries, currentPeriod, daysLeft } from '../lib/giveaway'
import { useApp } from '../state/AppState'
import { useToast } from '../state/Toasts'

const PAST_WINNERS = ['ines', 'javier', 'tiago']

export default function Giveaway() {
  const { state, joinGiveaway } = useApp()
  const toast = useToast()
  const anglerName = useAnglerName()
  const period = currentPeriod(state.anchor)
  const left = daysLeft(period, state.anchor)
  const entries = countEntries(period, state.myCatches, state.myReports, state.subscription.active)
  const joined = state.giveawayJoined.includes(period.key)
  const freq = brand.giveaway.frequency

  const past = PAST_WINNERS.map((id, i) => {
    const [y, m] = period.start.split('-').map(Number)
    const ref = freq === 'semanal' ? addDaysISO(period.start, -7 * (i + 1)) : toISODate(new Date(y, m - 2 - i, 15, 12))
    return { id, period: currentPeriod(ref) }
  })

  return (
    <div>
      <PageHeader back="/comunidade" title={`Giveaway ${freq}`} eyebrow="Comunidade" />
      <div className="mx-auto max-w-4xl px-4 pt-4 lg:px-8">
        <section className="relative overflow-hidden rounded-[28px] bg-ink p-6 text-white shadow-lift sm:p-8">
          <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-amber/15 blur-2xl" aria-hidden />
          <div className="relative">
            <div className="flex flex-wrap gap-1.5">
              <Tag tone="amber">Sorteio fictício — demonstração</Tag>
              <Tag tone="glass">Sorteio {freq}</Tag>
            </div>
            <p className="mt-5 text-[13px] font-bold uppercase tracking-[0.14em] text-teal">Prémio de {period.label}</p>
            <h1 className="font-display mt-1.5 text-[30px] font-semibold leading-tight sm:text-[38px]">{brand.giveaway.prize}</h1>
            <div className="mt-6 grid grid-cols-3 gap-3 border-t border-white/10 pt-5">
              <div>
                <p className="tnum text-[26px] font-extrabold">{left}</p>
                <p className="text-[12px] font-semibold text-white/55">{left === 1 ? 'dia para o fim' : 'dias para o fim'}</p>
              </div>
              <div>
                <p className="tnum text-[26px] font-extrabold">{entries.total}</p>
                <p className="text-[12px] font-semibold text-white/55">participações tuas</p>
              </div>
              <div>
                <p className="tnum text-[26px] font-extrabold">{formatDate(addDaysISO(period.end, 1))}</p>
                <p className="text-[12px] font-semibold text-white/55">dia do sorteio</p>
              </div>
            </div>
            <div className="mt-6">
              {joined ? (
                <p className="inline-flex h-12 items-center gap-2 rounded-full bg-white/10 px-5 text-[14px] font-extrabold">
                  <Check className="h-5 w-5 text-teal" aria-hidden /> Estás a participar neste período
                </p>
              ) : (
                <Button
                  size="lg"
                  icon={Gift}
                  onClick={() => {
                    joinGiveaway(period.key)
                    toast('Inscrição no giveaway feita', { detail: `Tens ${entries.total} participações neste período (demonstração).` })
                  }}
                >
                  Participar no giveaway
                </Button>
              )}
            </div>
          </div>
        </section>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          <Card className="p-5">
            <h2 className="text-[15px] font-extrabold text-ink">Como ganhar participações</h2>
            <ul className="mt-3 space-y-3 text-[14px]">
              <li className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-teal-50 text-teal-700"><Fish className="h-[18px] w-[18px]" aria-hidden /></span>
                <span className="flex-1 font-semibold text-ink">1 por captura pública registada</span>
                <b className="tnum text-ink">{entries.catches}</b>
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-amber-50 text-amber-800"><Radio className="h-[18px] w-[18px]" aria-hidden /></span>
                <span className="flex-1 font-semibold text-ink">1 por report publicado</span>
                <b className="tnum text-ink">{entries.reports}</b>
              </li>
              <li className="flex items-center gap-3">
                <span className="grid h-9 w-9 place-items-center rounded-xl bg-mist text-ink"><Trophy className="h-[18px] w-[18px]" aria-hidden /></span>
                <span className="flex-1 font-semibold text-ink">+2 para subscritores {brand.subscription.name}</span>
                <b className="tnum text-ink">{entries.bonus}</b>
              </li>
            </ul>
            <p className="mt-3 text-[12.5px] text-muted">Máximo de {brand.giveaway.maxEntries} participações por período. Contam apenas registos entre {formatDate(period.start)} e {formatDate(period.end)}.</p>
            <div className="mt-4 flex flex-wrap gap-2">
              <ButtonLink to="/capturas/nova" size="sm">Registar captura</ButtonLink>
              <ButtonLink to="/reports/novo" size="sm" variant="outline">Publicar report</ButtonLink>
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-[15px] font-extrabold text-ink">Vencedores anteriores</h2>
            <ul className="mt-3 divide-y divide-line">
              {past.map((p) => (
                <li key={p.period.key} className="flex items-center gap-3 py-3">
                  <Avatar anglerId={p.id} size={34} />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14px] font-extrabold text-ink">{anglerName(p.id)}{p.id === DEMO_USER_ID && ' (tu)'}</span>
                    <span className="block text-[12.5px] text-muted">{capFirst(p.period.label)}</span>
                  </span>
                  <Tag tone="amber">Fictício</Tag>
                </li>
              ))}
            </ul>
            <p className="mt-3 flex items-start gap-2 text-[12.5px] leading-relaxed text-muted">
              <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
              Nesta fase o sorteio é {freq}. Se a comunidade crescer, pode passar a semanal.
            </p>
          </Card>
        </div>

        <p className="mt-5 flex gap-2 text-[12.5px] leading-relaxed text-muted">
          <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          Sorteio fictício, sem prémio real. Um giveaway real precisa de regulamento próprio e de cumprir os requisitos legais aplicáveis a sorteios em Portugal e Espanha.
        </p>
      </div>
    </div>
  )
}
