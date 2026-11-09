import { ArrowRight, BookOpen, CalendarPlus, ExternalLink, Fish, Heart, MapPin, Scale, X } from 'lucide-react'
import { Link } from 'react-router'
import { damById } from '../../data/dams'
import { ZONE_KIND } from '../../data/zones'
import { TYPE_LABEL, type AtlasFeature, type AtlasSource, type AtlasType } from '../../lib/atlas/model'
import { zonesForWater } from '../../lib/atlas/registry'
import { normalize } from '../../lib/atlas/search'
import { flowUrls } from '../../lib/atlas/urlState'
import { AREA_TIERS } from '../../lib/map/waterConfig'
import { useDamPhotos } from '../photo/useDamPhotos'
import { PhotoImage } from '../photo/PhotoImage'
import { cx } from '../ui'
import type { AtlasPick } from './AtlasMap'
import { CartoHeader } from './CartoHeader'

const COUNTRY: Record<string, string> = { PT: 'Portugal', ES: 'Espanha' }
export const countriesLabel = (cs: string[]) => cs.map((c) => COUNTRY[c] ?? c).join(' · ')
export const fmtArea = (km2: number) =>
  km2 >= 1 ? `${km2.toLocaleString('pt-PT', { maximumFractionDigits: 1 })} km²` : `${Math.max(1, Math.round(km2 * 100)).toLocaleString('pt-PT')} ha`
const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })

/** Tipo a partir de um toque no mapa (antes de o registo estar carregado). */
export function typeOfPick(p: AtlasPick): AtlasType {
  if (p.kind === 'river' || p.kind === 'basemap-river') return 'rio'
  if (p.kind === 'structure') return p.props.skind === 'weir' || p.props.kind === 'weir' ? 'acude' : 'barragem'
  if (p.kind === 'basemap-water') return p.props.class === 'river' ? 'rio' : 'lagoa'
  return 'albufeira'
}

export interface DetailsProps {
  feature: AtlasFeature | null
  pick: AtlasPick | null
  sectionId?: string
  sources: Record<string, AtlasSource> | null
  isFavorite: boolean
  onFavorite: (() => void) | null
  onClose: () => void
  onSection: (id: string) => void
  onRelated: (id: string) => void
  onFrame: () => void
  loadingRegistry: boolean
  /** Ações contextuais da massa de água: marcar aqui, ver os meus pins, preparar jornada. */
  waterActions?: { onMark: () => void; onMine: () => void; planHref: string; mineCount: number | null }
}

/** Ficha do Atlas: cartografia real separada da informação do catálogo (demonstração). */
export function AtlasDetails({ feature, pick, sectionId, sources, isFavorite, onFavorite, onClose, onSection, onRelated, onFrame, loadingRegistry, waterActions }: DetailsProps) {
  const type: AtlasType = feature?.type ?? (pick ? typeOfPick(pick) : 'albufeira')
  const basemap = !feature && (pick?.kind === 'basemap-water' || pick?.kind === 'basemap-river')
  const catalogId = feature?.catalogId ?? (pick?.props.catalog ? String(pick.props.catalog) : undefined)
  const dam = catalogId ? damById[catalogId] : undefined
  const rawName = feature?.name || pick?.name || ''
  const fromDam = rawName.match(/^Albufeira \((.+)\)$/)
  const name = fromDam ? `Albufeira · ${fromDam[1]}` : rawName || (type === 'barragem' ? 'Barragem sem nome nos dados' : type === 'acude' ? 'Açude sem nome nos dados' : basemap ? 'Massa de água sem nome nos dados' : 'Albufeira sem nome nos dados')
  const area = feature?.areaKm2 ?? (pick?.props.area_km2 !== undefined ? Number(pick.props.area_km2) : undefined)
  const tier = feature?.tier ?? (pick?.props.tier ? Number(pick.props.tier) : undefined)
  const waterId = type === 'albufeira' && !feature?.approximate ? feature?.id ?? (pick?.kind === 'water' ? pick.mapId : undefined) : undefined
  const zones = waterId ? zonesForWater(waterId) : []
  const source = feature ? sources?.[feature.source] : undefined
  // Nomes alternativos úteis: sem repetir o nome principal (nem a forma curta já contida nele).
  const inName = (a: string) => normalize(rawName).includes(normalize(a)) || (dam ? normalize(dam.name) === normalize(a) : false)
  const alt = (feature?.altNames ?? []).filter((a) => !inName(a) && !/^Albufeira \(/.test(a)).slice(0, 4)
  const where = [feature?.region?.province, feature?.region?.region].filter((v, i, a) => v && a.indexOf(v) === i).join(' · ')
  const operator = feature?.extra?.operator ?? (pick?.props.operator ? String(pick.props.operator) : '')
  const height = feature?.extra?.heightM ?? (pick?.props.height ? String(pick.props.height) : '')

  return (
    <article className="pb-2" aria-labelledby="atlas-detail-title" data-atlas-detail={feature?.id ?? pick?.mapId ?? ''} data-catalog={catalogId ?? ''} data-catalog-name={dam?.name ?? ''}>
      <div className="relative">
        {dam ? <DamHeader damId={dam.id} feature={feature} sectionId={sectionId} /> : feature ? <CartoHeader feature={feature} highlightSection={sectionId} /> : <div className="h-[132px] rounded-2xl bg-[#0b2230]" aria-hidden />}
        <button type="button" onClick={onClose} aria-label="Fechar ficha" className="press absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full bg-[#071923]/70 text-[#f4f7f8] backdrop-blur hover:bg-[#071923]">
          <X className="h-[18px] w-[18px]" aria-hidden />
        </button>
      </div>

      <p className="mt-3 text-[11px] font-bold uppercase tracking-[0.16em] text-[#83e5ef]">
        {basemap ? (type === 'rio' ? 'Curso de água · mapa base' : 'Lago, lagoa ou albufeira < 5 ha · mapa base') : TYPE_LABEL[type]}
        {feature?.approximate ? ' · posição aproximada' : ''}
      </p>
      <h2 id="atlas-detail-title" className="font-display mt-1 text-[26px] font-semibold leading-tight text-[#f4f7f8]">
        {name}
      </h2>
      {(alt.length > 0 || (dam && dam.name !== rawName)) && (
        <p className="mt-0.5 text-[12.5px] text-[#b5c5cc]">
          {[...(dam && dam.name !== rawName ? [`Ficha: ${dam.name}`] : []), ...alt].join(' · ')}
        </p>
      )}
      <p className="mt-1.5 flex items-start gap-1.5 text-[13px] text-[#b5c5cc]">
        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden />
        <span>{[countriesLabel(feature?.countries ?? []), where].filter(Boolean).join(' · ') || (loadingRegistry ? 'A carregar localização…' : 'Localização administrativa não disponível')}</span>
      </p>

      <div className="mt-3 flex flex-wrap gap-2">
        {onFavorite ? (
          <button
            type="button"
            onClick={onFavorite}
            aria-pressed={isFavorite}
            className={cx('press inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-[13.5px] font-bold', isFavorite ? 'border-[#e6b65a]/60 bg-[#e6b65a]/15 text-[#e6b65a]' : 'border-white/15 text-[#f4f7f8] hover:bg-white/10')}
          >
            <Heart className={cx('h-4 w-4', isFavorite && 'fill-[#e6b65a]')} aria-hidden /> {isFavorite ? 'Favorita' : 'Favoritar'}
          </button>
        ) : null}
        <button type="button" onClick={onFrame} className="press inline-flex h-11 items-center gap-1.5 rounded-full border border-white/15 px-4 text-[13.5px] font-bold text-[#f4f7f8] hover:bg-white/10">
          Enquadrar
        </button>
      </div>

      {waterActions && (
        <div className="mt-4 grid gap-2" data-water-actions>
          <button type="button" onClick={waterActions.onMark} className="press flex h-12 items-center justify-between rounded-2xl bg-[#38c9d5] px-4 text-[14.5px] font-extrabold text-[#071923] hover:bg-[#5fd6e0]" data-action="marcar-aqui">
            <span className="flex items-center gap-2">
              <Fish className="h-[18px] w-[18px]" aria-hidden /> Marcar aqui
            </span>
            <ArrowRight className="h-4 w-4" aria-hidden />
          </button>
          <div className="grid grid-cols-2 gap-2">
            <button type="button" onClick={waterActions.onMine} className="press flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 px-2 text-[13.5px] font-bold text-[#f4f7f8] hover:bg-white/10" data-action="meus-pins">
              <BookOpen className="h-[18px] w-[18px]" aria-hidden /> Ver os meus pins{waterActions.mineCount != null ? ` (${waterActions.mineCount})` : ''}
            </button>
            <Link to={waterActions.planHref} className="press flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 px-2 text-[13.5px] font-bold text-[#f4f7f8] hover:bg-white/10" data-action="preparar-jornada">
              <CalendarPlus className="h-[18px] w-[18px]" aria-hidden /> Preparar jornada
            </Link>
          </div>
        </div>
      )}
      {catalogId && dam ? (
        <div className="mt-2 grid gap-2" data-flows>
          <Link to={flowUrls(catalogId).ficha} className="press flex h-12 items-center justify-center gap-2 rounded-2xl border border-white/15 text-[13.5px] font-bold text-[#f4f7f8] hover:bg-white/10" data-flow="ficha">
            <BookOpen className="h-[18px] w-[18px]" aria-hidden /> Abrir ficha da barragem
          </Link>
        </div>
      ) : waterActions ? null : (
        <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-3.5" data-no-catalog>
          <p className="text-[14px] font-bold text-[#f4f7f8]">Informação deste local ainda não disponível</p>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#b5c5cc]">
            Este elemento existe na cartografia, mas ainda não tem ficha Lança Lance. Preparar jornada e registar captura ficam disponíveis quando houver ficha.
          </p>
        </div>
      )}

      {type === 'rio' && feature?.sections && feature.sections.length > 1 && (
        <section className="mt-5" aria-labelledby="atlas-sections-h">
          <h3 id="atlas-sections-h" className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#b5c5cc]/80">
            Troços ({feature.sections.length})
          </h3>
          <p className="mt-1 text-[12px] text-[#b5c5cc]">Enquadre uma parte útil do rio, sem mostrar a extensão total.</p>
          <ul className="mt-2 grid gap-1">
            {feature.sections.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onSection(s.id)} aria-current={s.id === sectionId} className={cx('press flex min-h-11 w-full items-center justify-between gap-2 rounded-xl px-3 py-2 text-left text-[13px]', s.id === sectionId ? 'bg-[#83e5ef]/15 font-bold text-[#83e5ef]' : 'text-[#f4f7f8] hover:bg-white/5')}>
                  {s.label}
                  <ArrowRight className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-5" aria-labelledby="atlas-facts-h">
        <h3 id="atlas-facts-h" className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#b5c5cc]/80">
          Cartografia
        </h3>
        <dl className="mt-2 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-[13px]">
          {area !== undefined && Number.isFinite(area) && !basemap && (
            <>
              <dt className="text-[#b5c5cc]">Área do contorno</dt>
              <dd className="tnum text-[#f4f7f8]">
                {fmtArea(area)}
                {tier ? ` · ${AREA_TIERS.find((t) => t.tier === tier)?.label.toLowerCase()}` : ''}
              </dd>
            </>
          )}
          {feature?.lengthKm ? (
            <>
              <dt className="text-[#b5c5cc]">Extensão cartografada</dt>
              <dd className="tnum text-[#f4f7f8]">{feature.lengthKm.toLocaleString('pt-PT')} km (traçado generalizado)</dd>
            </>
          ) : null}
          {feature?.basin && (
            <>
              <dt className="text-[#b5c5cc]">Bacia</dt>
              <dd className="text-[#f4f7f8]">{feature.basin}</dd>
            </>
          )}
          {dam && (
            <>
              <dt className="text-[#b5c5cc]">Rio (ficha)</dt>
              <dd className="text-[#f4f7f8]">{dam.river}</dd>
            </>
          )}
          {feature?.extra?.damName && (
            <>
              <dt className="text-[#b5c5cc]">Barragem associada</dt>
              <dd className="text-[#f4f7f8]">{feature.extra.damName}</dd>
            </>
          )}
          {operator && (
            <>
              <dt className="text-[#b5c5cc]">Entidade</dt>
              <dd className="text-[#f4f7f8]">{operator}</dd>
            </>
          )}
          {height && (
            <>
              <dt className="text-[#b5c5cc]">Altura</dt>
              <dd className="tnum text-[#f4f7f8]">{height} m</dd>
            </>
          )}
        </dl>
        {feature?.related?.length ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {feature.related.slice(0, 3).map((r) => (
              <button key={r} type="button" onClick={() => onRelated(r)} className="press inline-flex h-10 items-center gap-1.5 rounded-full bg-white/5 px-3.5 text-[12.5px] font-bold text-[#83e5ef] hover:bg-white/10">
                {type === 'albufeira' ? 'Ver estrutura da barragem' : 'Ver albufeira'} <ArrowRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            ))}
          </div>
        ) : null}
        {(type === 'albufeira' || basemap) && <p className="mt-2 text-[11.5px] leading-relaxed text-[#b5c5cc]/80">Contorno de referência: não indica o nível atual da água nem a profundidade.</p>}
      </section>

      <section className="mt-5" aria-labelledby="atlas-rules-h">
        <h3 id="atlas-rules-h" className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#b5c5cc]/80">
          Regras de pesca
        </h3>
        {zones.length ? (
          zones.map(({ zone, partial }) => (
            <div key={zone.id} className="mt-2 rounded-2xl border border-[#e6b65a]/25 bg-[#e6b65a]/[0.07] p-3" data-zone={zone.id}>
              <p className="text-[11px] font-bold uppercase tracking-wider text-[#e6b65a]">
                {ZONE_KIND[zone.kind]}
                {zone.evidence === 'noticia' ? ' · sem documento oficial' : ''}
              </p>
              <p className="mt-0.5 text-[13.5px] font-bold text-[#f4f7f8]">{zone.name}</p>
              {zone.manager && <p className="text-[12px] text-[#b5c5cc]">{zone.manager}</p>}
              {partial && <p className="mt-1 text-[11.5px] text-[#b5c5cc]">A zona abrange só parte desta albufeira e/ou troços de rio: limites no documento.</p>}
              <a href={zone.source.url} target="_blank" rel="noopener noreferrer" className="mt-1.5 inline-flex items-center gap-1 text-[12.5px] font-bold text-[#e6b65a] hover:underline">
                {zone.source.label} <ExternalLink className="h-3 w-3" aria-hidden />
              </a>
            </div>
          ))
        ) : (
          <p className="mt-2 flex items-start gap-2 text-[13px] text-[#f4f7f8]">
            <Scale className="mt-0.5 h-4 w-4 shrink-0 text-[#b5c5cc]" aria-hidden />
            <span>
              Consultar regras aplicáveis. <Link to="/licencas" className="font-bold text-[#83e5ef] hover:underline">Licenças e lei</Link> ·{' '}
              <Link to="/zonas" className="font-bold text-[#83e5ef] hover:underline">Concessões e zonas</Link>
            </span>
          </p>
        )}
        <p className="mt-2 text-[11.5px] leading-relaxed text-[#b5c5cc]/80">A presença de água no mapa não indica autorização de pesca.</p>
      </section>

      {dam && (
        <section className="mt-5 rounded-2xl border border-[#e6b65a]/20 p-3" aria-labelledby="atlas-demo-h">
          <h3 id="atlas-demo-h" className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#e6b65a]">
            Ficha Lança Lance · demonstração
          </h3>
          <p className="mt-1 text-[12.5px] leading-relaxed text-[#b5c5cc]">
            {dam.place} · {dam.river}. Espécies, condições e características da ficha são dados de demonstração (não verificados): consulte-os na ficha.
          </p>
        </section>
      )}

      <section className="mt-5" aria-labelledby="atlas-src-h">
        <h3 id="atlas-src-h" className="text-[11.5px] font-bold uppercase tracking-[0.16em] text-[#b5c5cc]/80">
          Origem dos dados
        </h3>
        {basemap ? (
          <p className="mt-2 text-[12.5px] text-[#b5c5cc]">Mapa base OpenFreeMap (dados © contribuidores do OpenStreetMap, ODbL). Sem identificador estável no Atlas.</p>
        ) : source ? (
          <div className="mt-2 text-[12.5px] leading-relaxed text-[#b5c5cc]">
            <p className="text-[#f4f7f8]">{source.name}</p>
            <p>
              Licença: {source.licenseUrl ? <a href={source.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline">{source.license}</a> : source.license} · {source.attribution}
            </p>
            <p>
              {source.observedAt ? `Dados de ${fmtDate(source.observedAt)}` : source.version ? `Versão ${source.version}` : 'Data dos dados não publicada'} · registo atualizado em {fmtDate(source.processedAt)}
            </p>
            {feature?.sourceRefs.map((r) =>
              r.url ? (
                <a key={r.id} href={r.url} target="_blank" rel="noopener noreferrer" className="mt-0.5 inline-flex items-center gap-1 font-bold text-[#83e5ef] hover:underline">
                  Ver na fonte ({r.id}) <ExternalLink className="h-3 w-3" aria-hidden />
                </a>
              ) : null,
            )}
          </div>
        ) : (
          <p className="mt-2 text-[12.5px] text-[#b5c5cc]">{loadingRegistry ? 'A carregar…' : 'OpenStreetMap (ODbL).'}</p>
        )}
        <p className="mt-1.5 break-all text-[11px] text-[#b5c5cc]/60">ID: {feature?.id ?? pick?.mapId}</p>
      </section>
    </article>
  )
}

/** Cabeçalho de uma albufeira com ficha: fotografia só se mostrar mesmo este local; senão, cartográfico. */
function DamHeader({ damId, feature, sectionId }: { damId: string; feature: AtlasFeature | null; sectionId?: string }) {
  const { cover } = useDamPhotos(damId)
  const dam = damById[damId]
  const ofThisPlace = cover && (cover.asset.provider === 'unsplash' ? cover.asset.depicts === 'esta-albufeira' : cover.asset.identity === 'confirmado')
  if (ofThisPlace)
    return (
      <figure>
        <div className="relative h-[150px] overflow-hidden rounded-2xl">
          <PhotoImage dam={dam} photo={cover} variant="card" sizes="400px" />
        </div>
        <figcaption className="mt-1 text-[10.5px] text-[#b5c5cc]/70">
          {cover.asset.attribution}
        </figcaption>
      </figure>
    )
  return feature ? <CartoHeader feature={feature} highlightSection={sectionId} /> : <div className="h-[132px] rounded-2xl bg-[#0b2230]" aria-hidden />
}
