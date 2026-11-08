import { MapPin, Plus, Search } from 'lucide-react'
import { useMemo, useState } from 'react'
import { ButtonLink, Chip, EmptyState, inputCls } from '../../components/ui'
import { PinRow } from '../../components/lanca/cards'
import { ErrorBox, ListSkeleton, useLoad } from '../../components/lanca/primitives'
import { listPins, listPings } from '../../lib/lanca/api'
import { PIN_CATEGORIES } from '../../lib/lanca/labels'
import type { PinCategory } from '../../lib/lanca/types'

export default function Pins() {
  const { data, error, loading, reload } = useLoad(async () => {
    const [pins, pings] = await Promise.all([listPins(), listPings({ limit: 2000 })])
    const counts = new Map<string, number>()
    for (const p of pings) if (p.pin_id) counts.set(p.pin_id, (counts.get(p.pin_id) ?? 0) + 1)
    return { pins, counts }
  }, [])
  const [q, setQ] = useState('')
  const [cat, setCat] = useState<PinCategory | 'todas'>('todas')
  const [status, setStatus] = useState<'ativo' | 'arquivado' | 'favoritos'>('ativo')
  const list = useMemo(() => {
    const t = q.trim().toLowerCase()
    return (data?.pins ?? []).filter(
      (p) =>
        (status === 'favoritos' ? p.is_favorite && p.status === 'ativo' : p.status === status) &&
        (cat === 'todas' || p.category === cat) &&
        (!t || [p.name, p.water_body_name, p.description, ...p.tags, ...p.target_species].some((v) => v?.toLowerCase().includes(t))),
    )
  }, [data, q, cat, status])
  return (
    <div>
      <div className="mb-4 flex items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold text-ink">Os meus Pins</h1>
          <p className="text-[13.5px] text-muted">Locais permanentes: spots, acessos, perigos e pontos de interesse.</p>
        </div>
        <ButtonLink to="/conta/pins/novo" icon={Plus}>
          Novo Pin
        </ButtonLink>
      </div>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-subtle" aria-hidden />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Procurar por nome, água, espécie, etiqueta" className={`${inputCls} pl-10`} aria-label="Procurar Pins" />
      </div>
      <div className="no-scrollbar -mx-4 mb-2 flex gap-2 overflow-x-auto px-4">
        {(['ativo', 'favoritos', 'arquivado'] as const).map((s) => (
          <Chip key={s} active={status === s} onClick={() => setStatus(s)}>
            {s === 'ativo' ? 'Ativos' : s === 'favoritos' ? 'Favoritos' : 'Arquivados'}
          </Chip>
        ))}
      </div>
      <div className="no-scrollbar -mx-4 mb-4 flex gap-2 overflow-x-auto px-4">
        <Chip active={cat === 'todas'} onClick={() => setCat('todas')}>
          Todas as categorias
        </Chip>
        {PIN_CATEGORIES.map((c) => (
          <Chip key={c.id} active={cat === c.id} onClick={() => setCat(c.id)}>
            {c.label}
          </Chip>
        ))}
      </div>
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : loading ? (
        <ListSkeleton />
      ) : list.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={data?.pins.length ? 'Nenhum Pin com estes filtros' : 'Ainda não tem Pins'}
          text={data?.pins.length ? 'Altere a pesquisa ou os filtros.' : 'Guarde o primeiro local no mapa, ou crie um Ping e transforme o local num Pin.'}
          action={!data?.pins.length && <ButtonLink to="/conta/pins/novo" icon={Plus}>Criar Pin</ButtonLink>}
        />
      ) : (
        <ul className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
          {list.map((p) => (
            <li key={p.id}>
              <PinRow pin={p} extra={`${data?.counts.get(p.id) ?? 0} pings`} />
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
