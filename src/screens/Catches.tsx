import { Crown, Fish, LayoutGrid, List, Lock, Medal, Plus, Scale } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { CatchRow, CatchVisual } from '../components/bits'
import { SpeciesBars } from '../components/charts'
import { ButtonLink, Card, cx, DemoTag, EmptyState, Segmented, Stat } from '../components/ui'
import { SPECIES, speciesById } from '../data/catalog'
import { DAMS, damById } from '../data/dams'
import type { SpeciesId } from '../data/types'
import { formatDate, formatKg, formatKgShort } from '../lib/format'
import { isRankingEligible } from '../lib/ranking'
import { useApp } from '../state/AppState'

const selectCls =
  'h-11 w-full appearance-none rounded-full border border-line bg-white bg-[length:16px] bg-[right_14px_center] bg-no-repeat pl-4 pr-10 text-[14px] font-bold text-ink outline-none focus:border-teal focus:ring-4 focus:ring-teal/15'
const chevron = `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24' fill='none' stroke='%23566a73' stroke-width='2.5' stroke-linecap='round'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`

export default function Catches() {
  const { state } = useApp()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const dam = params.get('barragem') ?? ''
  const species = (params.get('especie') ?? '') as SpeciesId | ''
  const view = params.get('vista') === 'lista' ? 'lista' : 'grelha'
  const set = (k: string, v: string) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }

  const filtered = useMemo(
    () =>
      state.myCatches
        .filter((c) => (!dam || c.damId === dam) && (!species || c.speciesId === species))
        .sort((a, b) => b.date.localeCompare(a.date) || b.createdAt - a.createdAt),
    [state.myCatches, dam, species],
  )
  const total = filtered.reduce((s, c) => s + c.weightG, 0)
  const best = filtered.reduce<(typeof filtered)[number] | null>((b, c) => (!b || c.weightG > b.weightG ? c : b), null)
  const released = filtered.filter((c) => c.released).length
  const dist = SPECIES.map((s) => ({
    id: s.id,
    count: filtered.filter((c) => c.speciesId === s.id).length,
    weightG: filtered.filter((c) => c.speciesId === s.id).reduce((a, c) => a + c.weightG, 0),
  }))
    .filter((r) => r.count)
    .sort((a, b) => b.count - a.count)

  return (
    <div className="mx-auto max-w-6xl px-4 lg:px-8">
      <header className="pt-safe pt-5 lg:pt-8">
        <div className="flex items-center justify-between">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-teal-700">Diário de capturas</p>
          <span className="hidden sm:block"><DemoTag /></span>
        </div>
        <div className="mt-1 flex items-end justify-between gap-3">
          <h1 className="font-display text-[30px] font-semibold leading-tight text-ink sm:text-[36px]">As tuas capturas</h1>
          <Link to="/rankings" className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-white px-4 text-[13px] font-bold text-ink shadow-card hover:bg-mist">
            <Medal className="h-4 w-4 text-amber-800" aria-hidden /> Rankings
          </Link>
        </div>
        <p className="mt-1 text-[13px] text-muted">Guardadas apenas neste navegador. Não são partilhadas com outros utilizadores.</p>
      </header>

      <div className="mt-5 grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="order-2 lg:order-1">
          <div className="grid grid-cols-2 items-center gap-2.5 sm:flex">
            <select aria-label="Filtrar por barragem" value={dam} onChange={(e) => set('barragem', e.target.value)} className={cx(selectCls, 'sm:w-[220px]')} style={{ backgroundImage: chevron }}>
              <option value="">Todas as barragens</option>
              {DAMS.map((d) => (
                <option key={d.id} value={d.id}>
                  {d.name}
                </option>
              ))}
            </select>
            <select aria-label="Filtrar por espécie" value={species} onChange={(e) => set('especie', e.target.value)} className={cx(selectCls, 'sm:w-[200px]')} style={{ backgroundImage: chevron }}>
              <option value="">Todas as espécies</option>
              {SPECIES.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
            <Segmented
              label="Vista"
              value={view}
              onChange={(v) => set('vista', v === 'lista' ? 'lista' : '')}
              options={[
                { id: 'grelha', label: 'Grelha', icon: LayoutGrid },
                { id: 'lista', label: 'Lista', icon: List },
              ]}
              className="col-span-2 sm:ml-auto"
            />
          </div>

          <div className="mt-4">
            {filtered.length === 0 ? (
              <EmptyState
                icon={Fish}
                title={state.myCatches.length ? 'Nenhuma captura com estes filtros' : 'O teu diário está vazio'}
                text={state.myCatches.length ? 'Ajuste os filtros para ver outras capturas.' : 'Registe a primeira captura para começar a acompanhar a sua época.'}
                action={<ButtonLink to="/capturas/nova" icon={Plus}>Registar captura</ButtonLink>}
              />
            ) : view === 'grelha' ? (
              <ul className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                {filtered.map((c) => (
                  <li key={c.id}>
                    <Link to={`/capturas/${c.id}`} className="press group block overflow-hidden rounded-[var(--radius-card)] bg-white shadow-card hover:shadow-lift">
                      <div className="relative aspect-[4/3]">
                        <CatchVisual c={c} iconSize={34} />
                        {c.id === best?.id && (
                          <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded-full bg-amber px-2 py-0.5 text-[11px] font-extrabold text-ink">
                            <Crown className="h-3 w-3" aria-hidden /> Melhor
                          </span>
                        )}
                        {c.visibility === 'privada' && (
                          <span className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/35 text-white backdrop-blur" aria-label="Privada">
                            <Lock className="h-3.5 w-3.5" />
                          </span>
                        )}
                      </div>
                      <div className="p-3">
                        <p className="tnum text-[17px] font-extrabold text-ink">{formatKg(c.weightG)}</p>
                        <p className="truncate text-[13px] font-bold text-ink">{speciesById[c.speciesId].name}</p>
                        <p className="truncate text-[12px] text-muted">
                          {damById[c.damId].name} · {formatDate(c.date)}
                        </p>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <Card className="p-2">
                {filtered.map((c) => (
                  <CatchRow key={c.id} c={c} showAngler={false} onClick={() => navigate(`/capturas/${c.id}`)} />
                ))}
              </Card>
            )}
          </div>
        </div>

        <aside className="order-1 space-y-4 lg:order-2">
          <Card className="p-5">
            <div className="grid grid-cols-3 gap-3">
              <Stat label="Capturas" value={filtered.length} />
              <Stat label="Peso total" value={formatKgShort(total)} icon={Scale} />
              <Stat label="Libertadas" value={`${released}`} sub={filtered.length ? `${Math.round((released / filtered.length) * 100)} %` : '—'} />
            </div>
            {best && (
              <Link to={`/capturas/${best.id}`} className="press mt-4 flex items-center gap-3 rounded-2xl bg-ink p-3 text-white hover:bg-ink-2">
                <span className="h-12 w-12 shrink-0 overflow-hidden rounded-xl">
                  <CatchVisual c={best} iconSize={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 text-[11.5px] font-bold uppercase tracking-wider text-amber">
                    <Crown className="h-3 w-3" aria-hidden /> Melhor captura
                  </span>
                  <span className="block truncate text-[14px] font-bold">
                    {speciesById[best.speciesId].name} · {damById[best.damId].name}
                  </span>
                </span>
                <span className="tnum text-[16px] font-extrabold">{formatKg(best.weightG)}</span>
              </Link>
            )}
            {filtered.length > 0 && (
              <p className="mt-3 text-[12px] text-muted">
                {filtered.filter(isRankingEligible).length} de {filtered.length} participam no ranking de demonstração.
              </p>
            )}
          </Card>
          {dist.length > 0 && (
            <Card className="hidden p-5 sm:block lg:block">
              <h2 className="mb-4 text-[15px] font-extrabold text-ink">Distribuição por espécie</h2>
              <SpeciesBars rows={dist} />
            </Card>
          )}
        </aside>
      </div>
      {dist.length > 0 && (
        <Card className="mt-4 p-5 sm:hidden">
          <h2 className="mb-4 text-[15px] font-extrabold text-ink">Distribuição por espécie</h2>
          <SpeciesBars rows={dist} />
        </Card>
      )}
    </div>
  )
}
