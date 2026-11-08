import { Plus, Radio } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ButtonLink, EmptyState } from '../../components/ui'
import { PingRow } from '../../components/lanca/cards'
import { ErrorBox, ListSkeleton, useLoad } from '../../components/lanca/primitives'
import { listPings } from '../../lib/lanca/api'
import { speciesSummary } from '../../lib/lanca/intelligence'
import { useAuth } from '../../state/Auth'
import { PingFilterBar } from './PingFilterBar'
import { applyFilter, DEFAULT_FILTER } from './pingFilters'

const PAGE = 40

export default function Pings() {
  const { units } = useAuth()
  const { data, error, loading, reload } = useLoad(() => listPings({ limit: 2000 }), [])
  const [f, setF] = useState(DEFAULT_FILTER)
  const [shown, setShown] = useState(PAGE)
  const list = useMemo(() => applyFilter(data ?? [], f), [data, f])
  const species = useMemo(() => speciesSummary(data ?? []).map((s) => s.species), [data])
  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold text-ink">Os meus Pings</h1>
          <p className="text-[13.5px] text-muted">Cada experiência: capturas, tentativas, observações e dias sem captura.</p>
        </div>
        <ButtonLink to="/conta/pings/novo" icon={Plus}>
          Novo Ping
        </ButtonLink>
      </div>
      <PingFilterBar value={f} onChange={(v) => (setF(v), setShown(PAGE))} species={species} />
      <div className="mt-4">
        {error ? (
          <ErrorBox message={error} onRetry={reload} />
        ) : loading ? (
          <ListSkeleton rows={6} />
        ) : list.length === 0 ? (
          <EmptyState icon={Radio} title={data?.length ? 'Nenhum Ping com estes filtros' : 'Ainda não tem Pings'} text={data?.length ? 'Altere os filtros.' : 'Um Ping regista uma experiência em segundos: fotografia, local, hora e as condições do momento.'} action={!data?.length && <ButtonLink to="/conta/pings/novo" icon={Plus}>Criar o primeiro Ping</ButtonLink>} />
        ) : (
          <>
            <p className="mb-2 text-[12.5px] font-semibold text-muted">
              {list.length} {list.length === 1 ? 'Ping' : 'Pings'}
            </p>
            <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
              {list.slice(0, shown).map((p) => (
                <li key={p.id}>
                  <PingRow ping={p} units={units} />
                </li>
              ))}
            </ul>
            {shown < list.length && (
              <div className="mt-4 text-center">
                <button type="button" onClick={() => setShown((s) => s + PAGE)} className="press h-11 rounded-full border border-line bg-white px-5 text-sm font-bold text-ink">
                  Mostrar mais ({list.length - shown})
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
