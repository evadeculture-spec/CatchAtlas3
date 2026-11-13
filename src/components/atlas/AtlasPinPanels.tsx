import { BookOpen, CalendarRange, Compass, FileText, Home, Info, Lock, Scale, User, X } from 'lucide-react'
import { Link } from 'react-router'
import { Avatar } from '../bits'
import { ACTIVITY, periodName, SPECIES, speciesById } from '../../data/catalog'
import { damById } from '../../data/dams'
import type { Activity } from '../../data/types'
import { TYPE_LABEL, type FieldPinType } from '../../lib/lanca/fieldPins'
import { brand } from '../../config/brand'
import { SignedImage } from '../lanca/SignedImage'
import { cx } from '../ui'
import { pinIconSvg } from './pinLayers'
import type { CommunityFilter, CommunityItem } from './useAtlasPins'

const chipCls = (on: boolean) => cx('press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-bold', on ? 'border-[#f4f7f8] bg-[#f4f7f8] text-[#071923]' : 'border-white/15 text-[#f4f7f8] hover:bg-white/5')
const PERIOD: Record<string, string> = { madrugada: 'madrugada', manha: 'manhã', tarde: 'tarde', noite: 'noite' }

/** Filtros da camada comunitária (os mesmos de "Reports e pings": 3/7/30 dias, espécie, atividade). */
export function CommunityFilters({ value, onChange, count }: { value: CommunityFilter; onChange: (f: Partial<CommunityFilter>) => void; count: number }) {
  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-amber-200">
        <span className="h-1.5 w-1.5 rounded-full bg-amber-300" aria-hidden /> {brand.demoLabel} · posições aproximadas
      </p>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="group" aria-label="Período">
        {[3, 7, 30].map((d) => (
          <button key={d} type="button" aria-pressed={value.days === d} className={chipCls(value.days === d)} onClick={() => onChange({ days: d })}>
            {d} dias
          </button>
        ))}
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="group" aria-label="Espécie">
        {SPECIES.map((s) => (
          <button key={s.id} type="button" aria-pressed={value.species === s.id} className={chipCls(value.species === s.id)} onClick={() => onChange({ species: value.species === s.id ? null : s.id })}>
            {s.short}
          </button>
        ))}
      </div>
      <div className="no-scrollbar flex gap-1.5 overflow-x-auto" role="group" aria-label="Atividade">
        {(Object.keys(ACTIVITY) as Activity[]).map((a) => (
          <button key={a} type="button" aria-pressed={value.activity === a} className={chipCls(value.activity === a)} onClick={() => onChange({ activity: value.activity === a ? null : a })}>
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: ACTIVITY[a].color }} aria-hidden />
            {ACTIVITY[a].name}
          </button>
        ))}
      </div>
      <p className="text-[12px] text-[#b5c5cc]" aria-live="polite">
        {count} reports neste período
      </p>
    </div>
  )
}

export function CommunityList({ items, onSelect }: { items: CommunityItem[]; onSelect: (id: string) => void }) {
  if (!items.length) return <p className="rounded-2xl border border-white/10 p-4 text-[13px] text-[#b5c5cc]">Sem reports com estes filtros.</p>
  return (
    <ul className="space-y-1.5" aria-label="Reports da comunidade">
      {items.slice(0, 60).map((c) => (
        <li key={c.id}>
          <button type="button" onClick={() => onSelect(c.id)} className="press flex min-h-12 w-full items-center gap-3 rounded-2xl bg-white/5 px-3 py-2 text-left hover:bg-white/10">
            <span className="h-3 w-3 shrink-0 rounded-full border-2 border-[#071923]" style={{ background: c.kind === 'demo' ? ACTIVITY[c.report.activity].color : '#e6b65a' }} aria-hidden />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13.5px] font-bold">{c.kind === 'demo' ? `${speciesById[c.report.speciesId].name} · ${damById[c.report.damId]?.name ?? ''}` : `${c.shared.species ?? TYPE_LABEL[c.shared.kind === 'captura' ? 'captura' : 'observacao']} · ${c.shared.water_body_name ?? c.shared.approx_label}`}</span>
              <span className="block truncate text-[12px] text-[#b5c5cc]">{c.kind === 'demo' ? `${ACTIVITY[c.report.activity].name} · ${periodName(c.report.period)} · demonstração` : `${c.shared.occurred_on.split('-').reverse().join('/')} · partilhado (aproximado)`}</span>
            </span>
          </button>
        </li>
      ))}
    </ul>
  )
}

export function CommunityCard({ item, onClose }: { item: CommunityItem; onClose: () => void }) {
  return (
    <div className="space-y-3" data-community-card={item.kind}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#e6b65a]">{item.kind === 'demo' ? 'Comunidade · demonstração' : 'Comunidade · partilhado'}</p>
          <h2 className="text-[18px] font-extrabold">{item.kind === 'demo' ? speciesById[item.report.speciesId].name : (item.shared.species ?? (item.shared.kind === 'captura' ? 'Captura' : 'Observação'))}</h2>
        </div>
        <button type="button" onClick={onClose} className="press grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Fechar report">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {item.kind === 'demo' ? (
        <>
          <div className="flex items-center gap-3">
            <Avatar anglerId={item.report.anglerId} size={40} />
            <p className="text-[13px] text-[#d6e2e6]">
              {damById[item.report.damId]?.name} · {periodName(item.report.period).toLowerCase()} · {ACTIVITY[item.report.activity].name.toLowerCase()} · {item.report.catches} capturas
            </p>
          </div>
          <p className="text-[13px] text-[#d6e2e6]">
            {item.report.technique} · {item.report.lure}
          </p>
          {item.report.note && <p className="text-[13.5px]">“{item.report.note}”</p>}
          <p className="rounded-2xl bg-amber-50 px-3 py-2 text-[12px] font-semibold text-amber-900">Dados ilustrativos da demonstração. Posição aproximada na barragem, nunca o local exato.</p>
        </>
      ) : (
        <>
          {item.shared.photo_path && <SignedImage path={item.shared.photo_path} bucket="community-media" alt="Fotografia partilhada" className="aspect-[4/3] w-full rounded-2xl" />}
          <p className="text-[13px] text-[#d6e2e6]">
            {item.shared.approx_label} · {item.shared.occurred_on.split('-').reverse().join('/')}
            {item.shared.day_period ? ` · ${PERIOD[item.shared.day_period]}` : ''}
            {item.shared.technique ? ` · ${item.shared.technique}` : ''}
          </p>
          <p className="text-[12px] text-[#b5c5cc]">Versão partilhada por decisão do autor: zona aproximada (~{Math.round(item.shared.precision_km)} km), sem o ponto exato nem a hora.</p>
        </>
      )}
    </div>
  )
}

export interface PinListItem {
  id: string
  type: FieldPinType
  title: string | null
  when: string | null
  pending?: boolean
}
export function PinList({ title, items, selectedId, onSelect, onClose, empty }: { title: string; items: PinListItem[]; selectedId: string | null; onSelect: (id: string) => void; onClose: () => void; empty: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h2 className="text-[16px] font-extrabold">{title}</h2>
        <button type="button" onClick={onClose} className="press grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label="Fechar lista">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      {!items.length ? (
        <p className="rounded-2xl border border-white/10 p-4 text-[13px] text-[#b5c5cc]">{empty}</p>
      ) : (
        <ul className="space-y-1.5" aria-label={title}>
          {items.map((it) => (
            <li key={it.id}>
              <button type="button" aria-current={selectedId === it.id ? 'true' : undefined} onClick={() => onSelect(it.id)} className={cx('press flex min-h-12 w-full items-center gap-3 rounded-2xl px-3 py-2 text-left', selectedId === it.id ? 'bg-[#38c9d5]/20 ring-2 ring-[#38c9d5]' : 'bg-white/5 hover:bg-white/10')}>
                <span dangerouslySetInnerHTML={{ __html: pinIconSvg(it.type) }} className="grid h-6 w-6 shrink-0 place-items-center" aria-hidden />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13.5px] font-bold">{it.title || TYPE_LABEL[it.type]}</span>
                  <span className="block truncate text-[12px] text-[#b5c5cc]">
                    {TYPE_LABEL[it.type]}
                    {it.when ? ` · ${it.when}` : ''}
                    {it.pending ? ' · por sincronizar' : ''}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function LayersPopover({ mine, community, carp = false, onMine, onCommunity, onCarp, onClose, signedIn }: { mine: boolean; community: boolean; carp?: boolean; onMine: (v: boolean) => void; onCommunity: (v: boolean) => void; onCarp?: (v: boolean) => void; onClose: () => void; signedIn: boolean }) {
  const row = 'press flex min-h-12 w-full items-center justify-between gap-3 rounded-2xl px-3 text-left text-[13.5px] font-bold hover:bg-white/5'
  return (
    <div className="pointer-events-auto w-[260px] rounded-2xl border border-white/10 bg-[#0a2230]/96 p-2 shadow-xl backdrop-blur-xl" role="dialog" aria-label="Camadas" data-no-swipe>
      <div className="flex items-center justify-between px-2 pb-1">
        <p className="text-[12px] font-extrabold uppercase tracking-[0.14em] text-[#b5c5cc]">Camadas</p>
        <button type="button" onClick={onClose} className="press grid h-10 w-10 place-items-center rounded-full hover:bg-white/10" aria-label="Fechar camadas">
          <X className="h-4 w-4" aria-hidden />
        </button>
      </div>
      <button type="button" role="switch" aria-checked={mine} className={row} onClick={() => onMine(!mine)} disabled={!signedIn}>
        <span>
          Os meus pins
          <span className="block text-[11.5px] font-semibold text-[#b5c5cc]">{signedIn ? 'Privados, só na sua conta' : 'Entre na conta para os ver'}</span>
        </span>
        <span className={cx('h-6 w-10 rounded-full p-0.5 transition', mine && signedIn ? 'bg-[#38c9d5]' : 'bg-white/20')}>
          <span className={cx('block h-5 w-5 rounded-full bg-white transition', mine && signedIn && 'translate-x-4')} />
        </span>
      </button>
      <button type="button" role="switch" aria-checked={community} className={row} onClick={() => onCommunity(!community)}>
        <span>
          Comunidade
          <span className="block text-[11.5px] font-semibold text-[#b5c5cc]">Reports aproximados · demonstração</span>
        </span>
        <span className={cx('h-6 w-10 rounded-full p-0.5 transition', community ? 'bg-[#38c9d5]' : 'bg-white/20')}>
          <span className={cx('block h-5 w-5 rounded-full bg-white transition', community && 'translate-x-4')} />
        </span>
      </button>
      {onCarp && (
        <button type="button" role="switch" aria-checked={carp} className={row} onClick={() => onCarp(!carp)} data-layer="carpa">
          <span>
            Carpa
            <span className="block text-[11.5px] font-semibold text-[#b5c5cc]">Águas e setores · estado por data</span>
          </span>
          <span className={cx('h-6 w-10 rounded-full p-0.5 transition', carp ? 'bg-[#e6c36a]' : 'bg-white/20')}>
            <span className={cx('block h-5 w-5 rounded-full bg-white transition', carp && 'translate-x-4')} />
          </span>
        </button>
      )}
    </div>
  )
}

/** Menu de navegação do Atlas (ecrã principal): os destinos menos frequentes num único sítio. */
export function AtlasMenu({ onClose, onSources, signedIn }: { onClose: () => void; onSources: () => void; signedIn: boolean }) {
  const item = 'press flex min-h-12 items-center gap-3 rounded-2xl px-3 text-[14px] font-bold hover:bg-white/5'
  return (
    <div className="fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Menu">
      <button type="button" className="absolute inset-0 bg-black/45" onClick={onClose} aria-label="Fechar menu" />
      <nav className="absolute left-3 top-[calc(env(safe-area-inset-top)+10px)] w-[min(320px,calc(100vw-24px))] rounded-3xl border border-white/10 bg-[#0a2230] p-2 text-[#f4f7f8] shadow-2xl" aria-label="Destinos">
        <Link to={signedIn ? '/conta' : '/entrar'} className={item}>
          {signedIn ? <User className="h-5 w-5" aria-hidden /> : <Lock className="h-5 w-5" aria-hidden />} {signedIn ? 'A minha conta' : 'Entrar ou criar conta'}
        </Link>
        <Link to="/conta/historico" className={item}>
          <BookOpen className="h-5 w-5" aria-hidden /> Diário (Gera a tua história)
        </Link>
        <Link to="/conta/jornadas" className={item}>
          <CalendarRange className="h-5 w-5" aria-hidden /> Jornadas
        </Link>
        <span className="mx-3 my-1 block h-px bg-white/10" aria-hidden />
        <Link to="/inicio" className={item}>
          <Home className="h-5 w-5" aria-hidden /> Início (demonstração)
        </Link>
        <Link to="/explorar" className={item}>
          <Compass className="h-5 w-5" aria-hidden /> Explorar barragens
        </Link>
        <Link to="/zonas" className={item}>
          <FileText className="h-5 w-5" aria-hidden /> Concessões e zonas
        </Link>
        <Link to="/licencas" className={item}>
          <Scale className="h-5 w-5" aria-hidden /> Licenças e lei
        </Link>
        <button type="button" className={cx(item, 'w-full')} onClick={() => (onSources(), onClose())}>
          <Info className="h-5 w-5" aria-hidden /> Fontes e cobertura do mapa
        </button>
      </nav>
    </div>
  )
}
