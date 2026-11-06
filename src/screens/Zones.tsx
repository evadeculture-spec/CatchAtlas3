import { FileText, Map as MapIcon, MapPin, Users } from 'lucide-react'
import { Link, useSearchParams } from 'react-router'
import { ExploreTabs } from '../components/ExploreTabs'
import { SourceLink } from '../components/SourceLink'
import { Card, Chip, EmptyState, Tag } from '../components/ui'
import { damById } from '../data/dams'
import type { CountryId, FishingZone, ZoneKind } from '../data/types'
import { ZONE_KIND, ZONES } from '../data/zones'
import zoneWater from '../data/map/zoneWater.json'

const ZONE_WATER = zoneWater as unknown as Record<string, { waterId: string; name: string }[]>

export function ZoneCard({ z, showDam = true }: { z: FishingZone; showDam?: boolean }) {
  const dam = z.damId ? damById[z.damId] : undefined
  return (
    <Card className="p-5">
      <div className="flex flex-wrap gap-1.5">
        <Tag tone="ink">{ZONE_KIND[z.kind]}</Tag>
        <Tag>{z.country === 'PT' ? 'Portugal' : 'Espanha'}</Tag>
        {z.evidence === 'noticia' ? (
          <Tag tone="amber">Sem documento oficial · referida em notícia</Tag>
        ) : z.docYear ? (
          <Tag tone="teal">Documento {z.docYear}</Tag>
        ) : (
          <Tag tone="amber">Sem data · confirmar</Tag>
        )}
      </div>
      <h3 className="mt-3 text-[15.5px] font-extrabold leading-snug text-ink">{z.name}</h3>
      <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
        <MapPin className="h-3.5 w-3.5 shrink-0" aria-hidden />
        {z.place}
        {z.river && ` · ${z.river}`}
      </p>
      {z.manager && (
        <p className="mt-1 flex items-center gap-1.5 text-[13px] text-muted">
          <Users className="h-3.5 w-3.5 shrink-0" aria-hidden />
          {z.manager}
        </p>
      )}
      <ul className="mt-3 space-y-1.5">
        {z.notes.map((n) => (
          <li key={n} className="flex gap-2 text-[13.5px] leading-snug text-text">
            <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden />
            {n}
          </li>
        ))}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <SourceLink label={z.source.label} url={z.source.url} />
        {ZONE_WATER[z.id]?.map((w) => (
          <Link key={w.waterId} to={`/atlas?agua=${w.waterId}`} className="press inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[12px] font-bold text-ink hover:bg-mist">
            <MapIcon className="h-3.5 w-3.5" aria-hidden /> Ver no Atlas{ZONE_WATER[z.id].length > 1 ? ` · ${w.name}` : ''}
          </Link>
        ))}
        {showDam && dam && (
          <Link to={`/barragens/${dam.id}`} className="press inline-flex items-center rounded-full px-2.5 py-1 text-[12px] font-bold text-ink hover:bg-mist">
            Ver barragem {dam.name}
          </Link>
        )}
      </div>
    </Card>
  )
}

export default function Zones() {
  const [params, setParams] = useSearchParams()
  const country = params.get('pais') as CountryId | null
  const kind = params.get('tipo') as ZoneKind | null
  const set = (k: string, v: string | null) => {
    const next = new URLSearchParams(params)
    if (v) next.set(k, v)
    else next.delete(k)
    setParams(next, { replace: true })
  }
  const list = ZONES.filter((z) => (!country || z.country === country) && (!kind || z.kind === kind)).sort((a, b) => (b.docYear ?? 0) - (a.docYear ?? 0))

  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-8">
      <header className="pt-safe pt-5 lg:pt-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-teal-700">Explorar</p>
        <h1 className="font-display mt-1 text-[30px] font-semibold leading-tight text-ink sm:text-[36px]">Concessões e zonas de pesca</h1>
        <div className="mt-4">
          <ExploreTabs />
        </div>
      </header>
      <p className="mt-4 max-w-2xl text-[13.5px] leading-relaxed text-muted">
        Concessões, zonas de pesca lúdica e reservada e cotos com documento oficial identificado (as exceções estão assinaladas). Cada ficha liga ao edital, regulamento ou fonte e, quando a albufeira é conhecida, ao mapa. A lista é parcial: em Portugal, a lista completa está no geocatálogo do ICNF; em Espanha, nas ordens de pesca de cada comunidade.
      </p>
      <div className="no-scrollbar -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
        <Chip active={country === 'PT'} onClick={() => set('pais', country === 'PT' ? null : 'PT')}>Portugal</Chip>
        <Chip active={country === 'ES'} onClick={() => set('pais', country === 'ES' ? null : 'ES')}>Espanha</Chip>
        <span className="my-2 w-px shrink-0 bg-line" aria-hidden />
        {(Object.keys(ZONE_KIND) as ZoneKind[]).map((k) => (
          <Chip key={k} active={kind === k} onClick={() => set('tipo', kind === k ? null : k)}>{ZONE_KIND[k]}</Chip>
        ))}
      </div>
      <p className="mt-2 text-[12.5px] font-semibold text-muted">{list.length} {list.length === 1 ? 'registo' : 'registos'}</p>
      <div className="mt-3 grid gap-3 lg:grid-cols-2">
        {list.length ? list.map((z) => <ZoneCard key={z.id} z={z} />) : <EmptyState icon={FileText} title="Sem registos" text="Não há registos para estes filtros." />}
      </div>
    </div>
  )
}
