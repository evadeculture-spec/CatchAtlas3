import { ChevronRight, Heart, Layers, Loader2, Search, TriangleAlert } from 'lucide-react'
import { useState } from 'react'
import { TYPE_LABEL, type AtlasFeature } from '../../lib/atlas/model'
import type { SearchHit } from '../../lib/atlas/search'
import { cx } from '../ui'
import type { AtlasPick } from './AtlasMap'
import { countriesLabel, fmtArea, typeOfPick } from './AtlasDetails'

function Row({ item, selected, favorite, note, onSelect }: { item: AtlasFeature; selected: boolean; favorite: boolean; note?: string; onSelect: () => void }) {
  const name = item.name.match(/^Albufeira \((.+)\)$/) ? `Albufeira · ${item.name.slice(11, -1)}` : item.name || `${TYPE_LABEL[item.type]} sem nome nos dados`
  const where = [countriesLabel(item.countries), item.region?.province].filter(Boolean).join(' · ')
  const metric = item.type === 'rio' ? `${item.lengthKm?.toLocaleString('pt-PT')} km` : item.areaKm2 ? fmtArea(item.areaKm2) : ''
  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected || undefined}
        data-atlas-row={item.id}
        className={cx('press flex min-h-[52px] w-full items-center gap-3 rounded-xl px-3 py-2 text-left', selected ? 'bg-[#83e5ef]/15 ring-1 ring-[#83e5ef]/50' : 'hover:bg-white/5')}
      >
        <span
          className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-full text-[10px] font-extrabold', item.type === 'rio' ? 'bg-[#2fb6c3]/15 text-[#83e5ef]' : item.type === 'albufeira' ? 'bg-[#38c9d5]/20 text-[#83e5ef]' : 'bg-white/10 text-[#f4f7f8]')}
          aria-hidden
        >
          {item.type === 'rio' ? 'RIO' : item.type === 'albufeira' ? 'ÁG' : item.type === 'barragem' ? 'BAR' : 'AÇ'}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-1.5">
            <span className="truncate text-[14px] font-bold text-[#f4f7f8]">{name}</span>
            {favorite && <Heart className="h-3.5 w-3.5 shrink-0 fill-[#e6b65a] text-[#e6b65a]" aria-label="Favorita" />}
          </span>
          <span className="block truncate text-[12px] text-[#b5c5cc]">
            {TYPE_LABEL[item.type]}
            {where ? ` · ${where}` : ''}
            {metric ? ` · ${metric}` : ''}
          </span>
          {note && <span className="block truncate text-[11.5px] text-[#83e5ef]/80">{note}</span>}
        </span>
        {item.catalogId && <span className="shrink-0 rounded-full bg-[#38c9d5]/15 px-2 py-0.5 text-[10.5px] font-bold text-[#83e5ef]">Ficha</span>}
        <ChevronRight className="h-4 w-4 shrink-0 text-[#b5c5cc]/60" aria-hidden />
      </button>
    </li>
  )
}

export function ResultList({ items, selectedId, favorites, label, onSelect, notes, empty }: { items: AtlasFeature[]; selectedId: string | null; favorites: Set<string>; label: string; onSelect: (it: AtlasFeature) => void; notes?: Map<string, string>; empty?: React.ReactNode }) {
  const [limit, setLimit] = useState(40)
  if (!items.length) return <>{empty}</>
  return (
    <>
      <ul className="grid gap-0.5" aria-label={label} data-atlas-list>
        {items.slice(0, limit).map((it) => (
          <Row key={it.id} item={it} selected={it.id === selectedId} favorite={favorites.has(it.id)} note={notes?.get(it.id)} onSelect={() => onSelect(it)} />
        ))}
      </ul>
      {items.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + 40)} className="press mt-2 h-11 w-full rounded-xl border border-white/10 text-[13px] font-bold text-[#f4f7f8] hover:bg-white/5">
          Mostrar mais ({items.length - limit})
        </button>
      )}
    </>
  )
}

export function SearchResults({ hits, query, loading, error, onRetry, selectedId, favorites, onSelect }: { hits: SearchHit[]; query: string; loading: boolean; error: boolean; onRetry: () => void; selectedId: string | null; favorites: Set<string>; onSelect: (it: AtlasFeature) => void }) {
  if (error) return <RegistryError onRetry={onRetry} />
  if (loading)
    return (
      <p className="flex items-center gap-2 py-4 text-[13px] text-[#b5c5cc]" aria-live="polite">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden /> A preparar a pesquisa…
      </p>
    )
  const notes = new Map(hits.filter((h) => h.matchedAlt).map((h) => [h.item.id, `Também conhecido como ${h.matchedAlt}`]))
  return (
    <div aria-live="polite">
      <p className="mb-2 text-[12px] font-semibold text-[#b5c5cc]">
        {hits.length ? `${hits.length === 30 ? '30+' : hits.length} resultados para “${query.trim()}”` : ''}
      </p>
      <ResultList
        items={hits.map((h) => h.item)}
        notes={notes}
        selectedId={selectedId}
        favorites={favorites}
        label="Resultados da pesquisa"
        onSelect={onSelect}
        empty={
          <div className="rounded-2xl border border-white/10 p-4" data-atlas-empty>
            <p className="text-[14px] font-bold text-[#f4f7f8]">Sem resultados para “{query.trim()}”</p>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[#b5c5cc]">
              A pesquisa cobre albufeiras ≥ 5 ha do OpenStreetMap, barragens e açudes com nome, rios principais e as fichas CatchAtlas. Lagoas naturais e ribeiras locais ainda não estão no registo (veja-as no mapa, à escala local). Experimente outro nome, sem o tipo, ou retire filtros.
            </p>
          </div>
        }
      />
    </div>
  )
}

export function Chooser({ picks, onChoose, onCancel }: { picks: AtlasPick[]; onChoose: (p: AtlasPick) => void; onCancel: () => void }) {
  return (
    <div role="dialog" aria-labelledby="atlas-chooser-h" data-atlas-chooser>
      <p id="atlas-chooser-h" className="flex items-center gap-2 text-[14px] font-bold text-[#f4f7f8]">
        <Layers className="h-4 w-4 text-[#83e5ef]" aria-hidden /> Vários elementos neste ponto
      </p>
      <ul className="mt-2 grid gap-1">
        {picks.map((p) => (
          <li key={`${p.kind}:${p.mapId}`}>
            <button type="button" onClick={() => onChoose(p)} className="press flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left hover:bg-white/5">
              <span className="min-w-0">
                <span className="block truncate text-[14px] font-bold text-[#f4f7f8]">{p.name || 'Sem nome nos dados'}</span>
                <span className="block text-[12px] text-[#b5c5cc]">{TYPE_LABEL[typeOfPick(p)]}</span>
              </span>
              <ChevronRight className="h-4 w-4 shrink-0 text-[#b5c5cc]/60" aria-hidden />
            </button>
          </li>
        ))}
      </ul>
      <button type="button" onClick={onCancel} className="press mt-2 h-10 rounded-full px-4 text-[13px] font-bold text-[#b5c5cc] hover:bg-white/5">
        Cancelar
      </button>
    </div>
  )
}

export function RegistryError({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="rounded-2xl border border-amber-300/30 bg-amber-200/5 p-3.5" role="alert">
      <p className="flex items-center gap-2 text-[13.5px] font-bold text-amber-100">
        <TriangleAlert className="h-4 w-4" aria-hidden /> Não foi possível carregar a lista de águas.
      </p>
      <p className="mt-1 text-[12.5px] text-[#b5c5cc]">O mapa continua a funcionar. Verifique a ligação e tente de novo.</p>
      <button type="button" onClick={onRetry} className="press mt-2 h-10 rounded-full bg-white/10 px-4 text-[13px] font-bold text-[#f4f7f8] hover:bg-white/15">
        Tentar de novo
      </button>
    </div>
  )
}

/** Primeira vista do painel: o que se vê, como explorar e a legenda (sem descarregar o registo). */
export function AtlasIntro({ onList, onFocusSearch }: { onList: () => void; onFocusSearch: () => void }) {
  return (
    <div className="text-[#f4f7f8]">
      <p className="font-display text-[22px] font-semibold leading-snug">Da Península à margem.</p>
      <p className="mt-1.5 text-[13px] leading-relaxed text-[#b5c5cc]">
        Aproxime para descobrir albufeiras, rios e barragens com a geometria real. Toque numa massa de água para ver a ficha, preparar a jornada ou registar a captura.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="button" onClick={onList} className="press inline-flex h-11 items-center gap-2 rounded-full bg-[#38c9d5] px-4 text-[13.5px] font-extrabold text-[#071923] hover:bg-[#5fd6e0]">
          Lista desta vista
        </button>
        <button type="button" onClick={onFocusSearch} className="press inline-flex h-11 items-center gap-2 rounded-full border border-white/15 px-4 text-[13.5px] font-bold hover:bg-white/10">
          <Search className="h-4 w-4" aria-hidden /> Pesquisar
        </button>
      </div>
      <h3 className="mt-5 text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#b5c5cc]/80">Legenda</h3>
      <ul className="mt-2 grid gap-1.5 text-[12.5px] text-[#b5c5cc]">
        <li className="flex items-center gap-2.5"><span className="h-3 w-5 rounded-sm bg-[#38c9d5]" aria-hidden /> Albufeira (contorno OpenStreetMap)</li>
        <li className="flex items-center gap-2.5"><span className="h-[3px] w-5 rounded-full bg-[#2fb6c3]" aria-hidden /> Rio (traçado geral; detalhado à escala local)</li>
        <li className="flex items-center gap-2.5"><span className="mx-1 h-2.5 w-2.5 rounded-full border-2 border-[#071923] bg-[#f4f7f8]" aria-hidden /> Barragem (estrutura) · ficha CatchAtlas</li>
        <li className="flex items-center gap-2.5"><span className="mx-1 h-2.5 w-2.5 rounded-full bg-[#e6b65a]" aria-hidden /> Zona de pesca documentada · favorita</li>
      </ul>
      <p className="mt-4 text-[11.5px] leading-relaxed text-[#b5c5cc]/80">
        Recorte: Portugal continental e Espanha peninsular. A espessura da peça é gráfica; o relevo vem de um modelo digital de terreno. Contornos de referência: não indicam o nível atual da água.
      </p>
    </div>
  )
}
