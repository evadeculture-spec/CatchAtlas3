import { BarChart3, Info } from 'lucide-react'
import { useMemo } from 'react'
import { ButtonLink, EmptyState } from '../../components/ui'
import { ErrorBox, ListSkeleton, Notice, Panel, useLoad } from '../../components/lanca/primitives'
import { listPings } from '../../lib/lanca/api'
import { analyse, isSession, isSuccess, MIN_SAMPLE, type Bucket } from '../../lib/lanca/intelligence'
import { plural } from '../../lib/lanca/labels'
import { localMonth } from '../../lib/lanca/time'
import { fmt } from '../../lib/lanca/units'
import { useAuth } from '../../state/Auth'

const MONTHS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

function Buckets({ title, buckets, note }: { title: string; buckets: Bucket[]; note?: string }) {
  if (!buckets.length) return null
  return (
    <Panel title={title}>
      <ul className="space-y-2.5">
        {buckets.map((b) => (
          <li key={b.key} className={b.sufficient ? '' : 'opacity-60'}>
            <div className="mb-1 flex items-baseline justify-between gap-2 text-[13px]">
              <span className="font-bold text-ink">{b.label}</span>
              <span className="tnum shrink-0 text-muted">
                {b.successes}/{b.n} com captura{b.sufficient && b.rate != null ? ` · ${Math.round(b.rate * 100)} %` : ' · amostra insuficiente'}
              </span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-mist" role="img" aria-label={`${b.label}: ${b.successes} de ${b.n} sessões com captura`}>
              <div className="h-full rounded-full bg-teal" style={{ width: `${b.n ? (b.successes / b.n) * 100 : 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[11.5px] text-subtle">n = número de sessões. Grupos com menos de {MIN_SAMPLE} sessões aparecem esbatidos e sem percentagem.{note ? ` ${note}` : ''}</p>
    </Panel>
  )
}

export default function Intelligence() {
  const { units } = useAuth()
  const { data, error, loading, reload } = useLoad(() => listPings({ limit: 5000 }), [])
  const r = useMemo(() => (data ? analyse(data) : null), [data])
  const monthly = useMemo(() => {
    const act = Array(12).fill(0) as number[]
    const ok = Array(12).fill(0) as number[]
    for (const p of data ?? []) {
      if (!isSession(p)) continue
      const m = localMonth(p.occurred_at, p.occurred_tz) - 1
      act[m]++
      if (isSuccess(p)) ok[m]++
    }
    return { act, ok, max: Math.max(1, ...act) }
  }, [data])
  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (loading || !r) return <ListSkeleton rows={5} />
  if (r.sessions === 0)
    return (
      <EmptyState icon={BarChart3} title="Ainda sem dados para analisar" text="Registe sessões de pesca (com e sem captura). As estatísticas aparecem com base nos seus próprios Pings." action={<ButtonLink to="/conta/pings/novo">Criar Ping</ButtonLink>} />
    )
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-[24px] font-extrabold text-ink">Inteligência de pesca</h1>
        <p className="text-[13.5px] text-muted">Estatística descritiva dos seus registos. Mostra o que aconteceu, não o que vai acontecer.</p>
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {[
          ['Sessões', r.sessions],
          ['Com captura', r.successes],
          ['Com condições', r.withConditions],
        ].map(([l, v]) => (
          <div key={l} className="rounded-[var(--radius-card)] bg-white p-4 text-center shadow-card">
            <p className="tnum text-[24px] font-extrabold text-ink">{v}</p>
            <p className="text-[12px] font-bold text-muted">{l}</p>
          </div>
        ))}
      </div>
      <Notice>
        <strong>Como ler:</strong> correlação não é causalidade. Uma condição frequente nas suas capturas pode refletir apenas quando costuma ir pescar. As condições meteorológicas são estimativas de modelo para a célula (~1 km), não medições no local. Não são calculadas probabilidades de captura.
      </Notice>
      {r.sessions < MIN_SAMPLE && <Notice tone="warn">Tem {plural(r.sessions, 'sessão registada', 'sessões registadas')}. São precisas pelo menos {MIN_SAMPLE} por grupo para mostrar percentagens.</Notice>}
      {r.highlights.length > 0 && (
        <Panel title="Destaques" kicker="Com amostra suficiente">
          <ul className="space-y-2 text-[13.5px] leading-relaxed text-text">
            {r.highlights.map((h) => (
              <li key={h} className="flex gap-2">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" aria-hidden /> {h}
              </li>
            ))}
          </ul>
        </Panel>
      )}
      <Panel title="Atividade ao longo do ano">
        <div className="flex h-36 items-end gap-1.5" role="img" aria-label="Sessões e sessões com captura por mês">
          {monthly.act.map((v, i) => (
            <div key={i} className="flex flex-1 flex-col items-center gap-1">
              <span className="tnum text-[10px] font-bold text-subtle">{v || ''}</span>
              <div className="relative w-full rounded-t-md bg-mist" style={{ height: `${(v / monthly.max) * 100}px` }}>
                <div className="absolute inset-x-0 bottom-0 rounded-t-md bg-teal" style={{ height: `${v ? (monthly.ok[i] / v) * 100 : 0}%` }} />
              </div>
              <span className="text-[10.5px] font-bold text-muted">{MONTHS[i]}</span>
            </div>
          ))}
        </div>
        <p className="mt-2 flex gap-3 text-[11.5px] text-muted">
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-mist ring-1 ring-line" /> sessões</span>
          <span className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-sm bg-teal" /> com captura</span>
        </p>
      </Panel>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Buckets title="Período do dia" buckets={r.byPeriod} note="Hora local do acontecimento." />
        <Buckets title="Estação do ano" buckets={r.bySeason} />
        <Buckets title="Tendência da pressão (3 h)" buckets={r.byPressure} note="Só sessões com condições obtidas." />
        <Buckets title="Temperatura do ar" buckets={r.byTemp} />
        <Buckets title="Vento" buckets={r.byWind} />
        <Buckets title="Fase da lua" buckets={r.byMoon} />
        <Buckets title="Locais (Pins)" buckets={r.byPin.slice(0, 10)} />
        <Buckets title="Técnicas" buckets={r.byTechnique.slice(0, 10)} />
        <Buckets title="Iscos" buckets={r.byBait.slice(0, 10)} />
      </div>
      {r.bySpecies.length > 0 && (
        <Panel title="Espécies registadas">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="text-left text-subtle">
                <th className="py-1 font-bold">Espécie</th>
                <th className="py-1 text-right font-bold">Registos</th>
                <th className="py-1 text-right font-bold">Maior</th>
                <th className="py-1 text-right font-bold">Devolvidos</th>
              </tr>
            </thead>
            <tbody className="tnum">
              {r.bySpecies.map((s) => (
                <tr key={s.species} className="border-t border-line/70">
                  <td className="py-1.5 font-bold text-ink">{s.species}</td>
                  <td className="py-1.5 text-right">{s.count}</td>
                  <td className="py-1.5 text-right">{fmt.length(s.maxLengthCm, units) ?? fmt.weight(s.maxWeightG, units) ?? '—'}</td>
                  <td className="py-1.5 text-right">{s.released}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      )}
      <p className="text-[11.5px] text-subtle">Os seus dados privados não são usados para treinar modelos nem para estatísticas públicas.</p>
    </div>
  )
}
