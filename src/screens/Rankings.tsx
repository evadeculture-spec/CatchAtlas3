import { Crown, Info, Medal, Plus } from 'lucide-react'
import { useSearchParams, useNavigate } from 'react-router'
import { Avatar, useAnglerName } from '../components/bits'
import { ButtonLink, Card, cx, EmptyState, PageHeader, Segmented } from '../components/ui'
import { DEMO_USER_ID } from '../data/anglers'
import { SPECIES, speciesById } from '../data/catalog'
import { DAMS, damById } from '../data/dams'
import type { SpeciesId } from '../data/types'
import { formatDate, formatKg } from '../lib/format'
import { computeRanking, PERIODS, type RankMode, type RankPeriod } from '../lib/ranking'
import { useApp } from '../state/AppState'

const selectStyle = {
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23ffffff' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundSize: '16px',
  backgroundPosition: 'right 14px center',
  backgroundRepeat: 'no-repeat',
}

export default function Rankings() {
  const { state, allCatches } = useApp()
  const navigate = useNavigate()
  const anglerName = useAnglerName()
  const [params, setParams] = useSearchParams()
  const species = (speciesById[params.get('especie') as SpeciesId] ? params.get('especie') : (state.profile.species[0] ?? 'achiga')) as SpeciesId
  const damId = params.get('barragem') && damById[params.get('barragem')!] ? params.get('barragem')! : 'todas'
  const period = (PERIODS.find((p) => p.id === params.get('periodo'))?.id ?? '365') as RankPeriod
  const mode = (params.get('modo') === 'acumulado' ? 'acumulado' : 'maior') as RankMode
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    next.set(k, v)
    setParams(next, { replace: true })
  }

  const rows = computeRanking(allCatches, { species, damId, period, mode, ref: state.anchor })
  const myIdx = rows.findIndex((r) => r.anglerId === DEMO_USER_ID)
  const podium = rows.slice(0, 3)
  const order = [1, 0, 2].filter((i) => podium[i])
  const sp = speciesById[species]

  return (
    <div>
      <PageHeader back="/" title="Rankings" eyebrow="Comunidade · demonstração" />
      <div className="mx-auto max-w-5xl px-4 pt-4 lg:px-8">
        <section className="relative overflow-hidden rounded-[28px] bg-ink px-4 pb-6 pt-5 text-white sm:px-6">
          <div className="pointer-events-none absolute inset-0 opacity-[0.07]" style={{ backgroundImage: 'repeating-radial-gradient(circle at 50% 120%, #fff 0 1px, transparent 1px 22px)' }} aria-hidden />
          <div className="relative">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[11px] font-bold text-amber">
                <span className="h-1.5 w-1.5 rounded-full bg-amber" aria-hidden /> Ranking de demonstração
              </p>
              <Segmented
                label="Tipo de classificação"
                tone="dark"
                value={mode}
                onChange={(v) => set('modo', v)}
                options={[
                  { id: 'maior', label: 'Maior captura' },
                  { id: 'acumulado', label: 'Peso acumulado' },
                ]}
              />
            </div>
            <h1 className="font-display mt-4 text-[30px] font-semibold leading-tight sm:text-[36px]">
              {mode === 'maior' ? 'Maior' : 'Peso acumulado de'} {sp.name.toLowerCase()}
            </h1>
            <p className="mt-1 text-[13px] text-white/65">
              {damId === 'todas' ? 'Todas as barragens' : damById[damId].name} · {PERIODS.find((p) => p.id === period)?.label}
            </p>

            <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:-mx-6 sm:px-6">
              {SPECIES.map((s) => (
                <button
                  key={s.id}
                  onClick={() => set('especie', s.id)}
                  aria-pressed={species === s.id}
                  className={cx('press h-10 shrink-0 rounded-full px-4 text-[13px] font-bold', species === s.id ? 'bg-teal text-ink' : 'bg-white/10 text-white/80 hover:bg-white/15')}
                >
                  {s.name}
                </button>
              ))}
            </div>
            <div className="mt-2.5 flex flex-wrap gap-2">
              <select aria-label="Barragem" value={damId} onChange={(e) => set('barragem', e.target.value)} className="h-10 appearance-none rounded-full border border-white/15 bg-white/5 pl-4 pr-10 text-[13px] font-bold text-white outline-none focus:border-teal" style={selectStyle}>
                <option value="todas" className="text-ink">Todas as barragens</option>
                {DAMS.map((d) => (
                  <option key={d.id} value={d.id} className="text-ink">
                    {d.name}
                  </option>
                ))}
              </select>
              <select aria-label="Período" value={period} onChange={(e) => set('periodo', e.target.value)} className="h-10 appearance-none rounded-full border border-white/15 bg-white/5 pl-4 pr-10 text-[13px] font-bold text-white outline-none focus:border-teal" style={selectStyle}>
                {PERIODS.map((p) => (
                  <option key={p.id} value={p.id} className="text-ink">
                    {p.label}
                  </option>
                ))}
              </select>
            </div>

            {rows.length > 0 && (
              <ol className="mt-8 grid grid-cols-3 items-end gap-2 sm:gap-4" aria-label="Pódio">
                {order.map((i) => {
                  const r = podium[i]
                  const h = ['h-28', 'h-20', 'h-14'][i]
                  const me = r.anglerId === DEMO_USER_ID
                  return (
                    <li key={r.anglerId} className="flex flex-col items-center text-center">
                      <div className="relative">
                        {i === 0 && <Crown className="absolute -top-6 left-1/2 h-5 w-5 -translate-x-1/2 text-amber" aria-hidden />}
                        <Avatar anglerId={r.anglerId} size={i === 0 ? 60 : 48} ring />
                      </div>
                      <p className={cx('mt-2 w-full truncate text-[13px] font-extrabold', me && 'text-teal')}>
                        {anglerName(r.anglerId)}
                        {me && ' (tu)'}
                      </p>
                      <p className="tnum text-[13px] font-semibold text-white/80">{formatKg(r.valueG)}</p>
                      <div className={cx('mt-2 flex w-full items-start justify-center rounded-t-2xl pt-2', h, i === 0 ? 'bg-amber text-ink' : 'bg-white/12 text-white')}>
                        <span className="font-display text-[22px] font-semibold">{i + 1}</span>
                      </div>
                    </li>
                  )
                })}
              </ol>
            )}
          </div>
        </section>

        <div className="mt-4">
          {rows.length === 0 ? (
            <EmptyState
              icon={Medal}
              title="Sem capturas elegíveis"
              text={`Não há capturas públicas de ${sp.name.toLowerCase()} com participação no ranking para estes filtros.`}
              action={<ButtonLink to={`/capturas/nova?especie=${species}`} icon={Plus}>Registar captura</ButtonLink>}
            />
          ) : (
            <Card className="overflow-hidden">
              <ol>
                {rows.map((r, i) => {
                  const me = r.anglerId === DEMO_USER_ID
                  return (
                    <li key={r.anglerId} className="border-b border-line last:border-0">
                      <button onClick={() => navigate(`/capturas/${r.best.id}`)} className={cx('press flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-mist/60 sm:px-5', me && 'bg-teal-50 hover:bg-teal-50')}>
                        <span className={cx('tnum w-6 text-center text-[15px] font-extrabold', i < 3 ? 'text-amber-800' : 'text-muted')}>{i + 1}</span>
                        <Avatar anglerId={r.anglerId} size={38} />
                        <span className="min-w-0 flex-1">
                          <span className="block truncate text-[14.5px] font-extrabold text-ink">
                            {anglerName(r.anglerId)}
                            {me && <span className="ml-1.5 rounded-full bg-teal px-1.5 py-0.5 text-[10.5px] font-extrabold text-ink">TU</span>}
                          </span>
                          <span className="block truncate text-[12.5px] text-muted">
                            {mode === 'maior' ? `${damById[r.best.damId].name} · ${formatDate(r.best.date)}` : `${r.count} ${r.count === 1 ? 'captura' : 'capturas'} · maior ${formatKg(r.best.weightG)}`}
                          </span>
                        </span>
                        <span className="tnum text-[15px] font-extrabold text-ink">{formatKg(r.valueG)}</span>
                      </button>
                    </li>
                  )
                })}
              </ol>
            </Card>
          )}
          {myIdx === -1 && rows.length > 0 && (
            <div className="mt-3 flex items-center justify-between gap-3 rounded-[var(--radius-card)] border border-dashed border-line bg-white/70 p-4">
              <p className="text-[13.5px] font-semibold text-muted">Ainda não estás nesta classificação.</p>
              <ButtonLink to={`/capturas/nova?especie=${species}${damId !== 'todas' ? `&barragem=${damId}` : ''}`} size="sm" icon={Plus}>
                Registar
              </ButtonLink>
            </div>
          )}
          <p className="mt-4 flex gap-2 text-[12.5px] leading-relaxed text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
            Classificação comunitária de demonstração com perfis fictícios e as tuas capturas públicas. Cada ranking é de uma só espécie. Não corresponde a resultados de provas, que são publicados em cada prova.
          </p>
        </div>
      </div>
    </div>
  )
}
