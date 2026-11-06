import { ArrowRight, ChevronLeft, ChevronRight, Menu, X } from 'lucide-react'
import { useCallback, useLayoutEffect, useRef, useState, type KeyboardEvent, type PointerEvent, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { BrandLockup } from '../../components/BrandMark'
import { NavDrawer } from '../../components/NavDrawer'
import { cx } from '../../components/ui'
import { DAY_ART, NIGHT_ART, type StoryArt } from '../../data/storyArt'
import { greeting } from '../../lib/format'
import { useApp } from '../../state/AppState'
import { ArtImage, useReducedMotion } from './parts'
import { PreparePanel } from './PreparePanel'
import { StoryPanel } from './StoryPanel'

type StoryId = 'jornada' | 'historia'
const STORIES: { id: StoryId; label: string; art: StoryArt; tint: string }[] = [
  { id: 'jornada', label: 'Prepara a tua jornada', art: DAY_ART, tint: 'from-[#0d2a38]/95 via-[#0d2a38]/55' },
  { id: 'historia', label: 'Gera a tua história', art: NIGHT_ART, tint: 'from-[#070f1a]/95 via-[#070f1a]/60' },
]
const EASE = 'cubic-bezier(0.22, 1, 0.36, 1)'
const CLIP_FROM = ['inset(0 50% 0 0)', 'inset(0 0 0 50%)']
/** Elementos onde o gesto horizontal não deve mudar de história. */
const NO_SWIPE = '[data-no-swipe], input, textarea, select, [contenteditable="true"]'
const INTERACTIVE = 'a, button, input, select, textarea, label, summary, [role="button"]'

/**
 * Página inicial autenticada: ecrã dividido (Prepara a tua jornada | Gera a tua história).
 * Tocar numa metade expande-a para uma experiência imersiva com navegação ao estilo das histórias:
 * indicadores no topo, gesto horizontal, toque nas laterais, setas e teclado. Sem avanço automático.
 * O estado da vista vive no URL (?ver=jornada|historia) para o botão "voltar" do navegador funcionar.
 */
export default function StoriesHome() {
  const [params, setParams] = useSearchParams()
  const navigate = useNavigate()
  const reduce = useReducedMotion()
  const { state } = useApp()
  const ver = params.get('ver')
  const idx = ver === 'historia' ? 1 : ver === 'jornada' ? 0 : -1
  const open = idx >= 0
  // História mostrada (mantém-se quando o visualizador fecha, para a animação de saída).
  const [shown, setShown] = useState(open ? idx : 0)
  if (open && idx !== shown) setShown(idx)

  const [menu, setMenu] = useState(false)
  const viewer = useRef<HTMLDivElement>(null)
  const expandFrom = useRef<number | null>(null)
  const pushed = useRef(false)

  const openStory = (i: number) => {
    expandFrom.current = i
    pushed.current = true
    setParams({ ver: STORIES[i].id })
  }
  const goTo = useCallback((i: number) => setParams({ ver: STORIES[i].id }, { replace: true, preventScrollReset: true }), [setParams])

  // Expansão da metade escolhida até ocupar o ecrã.
  useLayoutEffect(() => {
    const el = viewer.current
    if (!open || !el) return
    if (expandFrom.current !== null && !reduce) {
      el.animate([{ clipPath: CLIP_FROM[expandFrom.current] }, { clipPath: 'inset(0 0 0 0)' }], { duration: 560, easing: EASE })
      el.querySelectorAll<HTMLElement>('[data-panel-content]').forEach((c) =>
        c.animate([{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 520, delay: 180, easing: EASE, fill: 'backwards' }),
      )
    }
    expandFrom.current = null
    el.focus({ preventScroll: true })
  }, [open, reduce])

  const close = () => {
    const finish = () => {
      if (pushed.current) {
        pushed.current = false
        navigate(-1)
      } else setParams({}, { replace: true })
    }
    const el = viewer.current
    if (!el || reduce) return finish()
    const a = el.animate([{ clipPath: 'inset(0 0 0 0)' }, { clipPath: CLIP_FROM[shown] }], { duration: 380, easing: 'cubic-bezier(0.4, 0, 0.2, 1)', fill: 'forwards' })
    a.finished.then(() => {
      finish()
      requestAnimationFrame(() => a.cancel())
    }, finish)
  }

  return (
    <div className="fixed inset-0 overflow-hidden bg-ink text-white">
      {/* Ecrã dividido 50/50 */}
      <div className="absolute inset-0 flex" aria-hidden={open} inert={open}>
        {STORIES.map((s, i) => (
          <SplitHalf key={s.id} story={s} index={i} onOpen={() => openStory(i)} />
        ))}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 w-px -translate-x-1/2 bg-white/15" aria-hidden />
        <div className="pointer-events-none absolute inset-x-0 top-0 flex items-start justify-between pt-[calc(env(safe-area-inset-top)+0.75rem)] bg-gradient-to-b from-black/45 to-transparent px-3 pb-10 sm:px-5">
          <MenuButton onClick={() => setMenu(true)} />
          <div className="pointer-events-auto flex flex-col items-center">
            <BrandLockup light compact />
            <h1 className="font-display mt-1.5 text-[14px] font-medium text-white/85 [text-shadow:0_1px_8px_rgb(0_0_0/0.45)] sm:text-[15px]">
              {greeting()}, {state.profile.name || 'Pescador'}.
            </h1>
          </div>
          <span className="w-11" aria-hidden />
        </div>
      </div>

      {/* Experiência imersiva (sempre montada: preserva formulários e posição de leitura) */}
      <StoryViewer ref={viewer} open={open} shown={shown} onGo={goTo} onClose={close} onMenu={() => setMenu(true)} />

      <NavDrawer open={menu} onClose={() => setMenu(false)} />
    </div>
  )
}

function MenuButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} aria-label="Abrir menu" className="press pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-black/25 text-white backdrop-blur-md hover:bg-black/40">
      <Menu className="h-5 w-5" />
    </button>
  )
}

function SplitHalf({ story, index, onOpen }: { story: (typeof STORIES)[number]; index: number; onOpen: () => void }) {
  const action = index === 0 ? 'Explorar' : 'Começar'
  return (
    <button
      type="button"
      onClick={onOpen}
      data-split={story.id}
      aria-label={`${story.label} — ${action}`}
      className="group relative h-full w-1/2 overflow-hidden text-left outline-none focus-visible:z-10 focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-teal"
    >
      <ArtImage art={story.art} sizes="50vw" priority className="transition-transform duration-[1400ms] ease-out group-hover:scale-[1.045]" />
      <div className={cx('absolute inset-0 bg-gradient-to-t to-transparent', story.tint)} aria-hidden />
      <div className="absolute inset-x-0 bottom-0 px-4 pb-[calc(env(safe-area-inset-bottom)+2rem)] sm:px-8 sm:pb-[calc(env(safe-area-inset-bottom)+3rem)] lg:px-12 lg:pb-[calc(env(safe-area-inset-bottom)+4rem)]">
        <span className={cx('block text-[10.5px] font-bold uppercase tracking-[0.2em] [text-shadow:0_1px_10px_rgb(0_0_0/0.6)] sm:text-[12px]', index === 0 ? 'text-teal' : 'text-[#9fd8ff]')}>
          {index === 0 ? '01 · Antes' : '02 · Depois'}
        </span>
        <span className="font-display mt-2 block max-w-[11ch] text-[clamp(1.6rem,6.6vw,4.5rem)] font-semibold leading-[1.02] tracking-[-0.01em] [text-wrap:balance] [text-shadow:0_2px_16px_rgb(0_0_0/0.3)]">
          {story.label}
        </span>
        <span className="mt-4 inline-flex h-10 items-center gap-1.5 rounded-full border border-white/35 px-4 text-[13.5px] font-bold backdrop-blur-sm transition group-hover:border-white group-hover:bg-white group-hover:text-ink sm:h-11 sm:px-5 sm:text-[14.5px]">
          {action} <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden />
        </span>
      </div>
    </button>
  )
}

interface ViewerProps {
  open: boolean
  shown: number
  onGo: (i: number) => void
  onClose: () => void
  onMenu: () => void
  ref: React.Ref<HTMLDivElement>
}

function StoryViewer({ open, shown, onGo, onClose, onMenu, ref }: ViewerProps) {
  const [dx, setDx] = useState(0)
  const [dragging, setDragging] = useState(false)
  const drag = useRef<{ id: number; x: number; y: number; t: number; axis: 'x' | 'y' | null; dx: number } | null>(null)
  const swallowClick = useRef(false)
  const last = STORIES.length - 1

  const onPointerDown = (e: PointerEvent<HTMLDivElement>) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if ((e.target as Element).closest(NO_SWIPE)) return
    drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY, t: performance.now(), axis: null, dx: 0 }
  }
  const onPointerMove = (e: PointerEvent<HTMLDivElement>) => {
    const d = drag.current
    if (!d || d.id !== e.pointerId) return
    const mx = e.clientX - d.x
    const my = e.clientY - d.y
    if (!d.axis) {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return
      d.axis = Math.abs(mx) > Math.abs(my) * 1.2 ? 'x' : 'y'
      if (d.axis === 'x') {
        try {
          e.currentTarget.setPointerCapture(e.pointerId)
        } catch {
          // O ponteiro já pode ter terminado; o gesto continua a funcionar sem captura.
        }
        setDragging(true)
      }
    }
    if (d.axis !== 'x') return
    // Resistência nas extremidades (não há história antes da primeira nem depois da última).
    const v = (shown === 0 && mx > 0) || (shown === last && mx < 0) ? mx * 0.25 : mx
    d.dx = v
    setDx(v)
  }
  const endDrag = (e: PointerEvent<HTMLDivElement>, cancelled = false) => {
    const d = drag.current
    drag.current = null
    if (!d || d.id !== e.pointerId) return
    if (d.axis === 'x') {
      swallowClick.current = true
      setDragging(false)
      setDx(0)
      if (cancelled) return
      const w = e.currentTarget.clientWidth || 1
      const fast = Math.abs(d.dx) > 30 && Math.abs(d.dx) / Math.max(1, performance.now() - d.t) > 0.45
      if ((d.dx < -w * 0.18 || (fast && d.dx < 0)) && shown < last) onGo(shown + 1)
      else if ((d.dx > w * 0.18 || (fast && d.dx > 0)) && shown > 0) onGo(shown - 1)
      return
    }
    if (!d.axis && !cancelled) {
      // Toque nas laterais (fora de elementos interativos) muda de história.
      if ((e.target as Element).closest(INTERACTIVE)) return
      const r = e.currentTarget.getBoundingClientRect()
      const rel = (e.clientX - r.left) / r.width
      if (rel < 0.16 && shown > 0) onGo(shown - 1)
      else if (rel > 0.84 && shown < last) onGo(shown + 1)
    }
  }
  const onKeyDown = (e: KeyboardEvent<HTMLDivElement>) => {
    if ((e.target as Element).closest('input, textarea, select, [contenteditable="true"]')) return
    if (e.key === 'ArrowRight' && shown < last) { e.preventDefault(); onGo(shown + 1) }
    else if (e.key === 'ArrowLeft' && shown > 0) { e.preventDefault(); onGo(shown - 1) }
    else if (e.key === 'Escape') { e.preventDefault(); onClose() }
  }

  return (
    <div
      ref={ref}
      tabIndex={-1}
      role="region"
      aria-roledescription="histórias"
      aria-label={`${STORIES[shown].label} (${shown + 1} de ${STORIES.length})`}
      aria-hidden={!open}
      inert={!open}
      data-story-viewer={open ? 'aberto' : 'fechado'}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={(e) => endDrag(e)}
      onPointerCancel={(e) => endDrag(e, true)}
      onClickCapture={(e) => {
        if (swallowClick.current) {
          swallowClick.current = false
          e.preventDefault()
          e.stopPropagation()
        }
      }}
      onKeyDown={onKeyDown}
      className={cx('absolute inset-0 z-20 overflow-hidden bg-ink outline-none [touch-action:pan-y]', !open && 'invisible', dragging && 'select-none')}
    >
      <div
        className="flex h-full w-[200%]"
        style={{
          transform: `translate3d(calc(${-shown * 50}% + ${dx}px), 0, 0)`,
          transition: dragging ? 'none' : `transform 460ms ${EASE}`,
        }}
      >
        {STORIES.map((s, i) => (
          <Panel key={s.id} story={s} active={i === shown} labelledBy={`story-${s.id}-title`}>
            {i === 0 ? <PreparePanel /> : <StoryPanel />}
          </Panel>
        ))}
      </div>

      {/* Indicadores e controlos (fixos por cima das histórias) */}
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-black/55 via-black/25 to-transparent px-3 pb-6 sm:px-5">
        <div className="mx-auto flex max-w-3xl gap-1.5 pt-2.5" role="tablist" aria-label="Experiências">
          {STORIES.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === shown}
              aria-label={`${s.label} (${i + 1} de ${STORIES.length})`}
              onClick={() => onGo(i)}
              className="pointer-events-auto relative -my-2 h-5 flex-1 py-2 outline-none focus-visible:[&>span]:ring-2 focus-visible:[&>span]:ring-teal"
              data-story-bar={i === shown ? 'ativo' : 'inativo'}
            >
              <span className="block h-[3px] overflow-hidden rounded-full bg-white/30">
                {i === shown && <span key={`${s.id}-${open}`} className="story-bar-fill block h-full w-full rounded-full bg-white" />}
              </span>
            </button>
          ))}
        </div>
        <div className="mx-auto mt-2 flex max-w-3xl items-center gap-2">
          <button type="button" onClick={onClose} aria-label="Voltar ao início" className="press pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-black/25 backdrop-blur-md hover:bg-black/40">
            <ChevronLeft className="h-5 w-5" />
          </button>
          <p className="min-w-0 flex-1 truncate text-[14px] font-bold" aria-live="polite">
            {STORIES[shown].label}
          </p>
          <button type="button" onClick={onMenu} aria-label="Abrir menu" className="press pointer-events-auto grid h-11 w-11 place-items-center rounded-full bg-black/25 backdrop-blur-md hover:bg-black/40">
            <Menu className="h-5 w-5" />
          </button>
          <button type="button" onClick={onClose} aria-label="Fechar e voltar ao ecrã dividido" className="press pointer-events-auto hidden h-11 w-11 place-items-center rounded-full bg-black/25 backdrop-blur-md hover:bg-black/40 sm:grid">
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Controlos laterais (rato/teclado; escondidos no telemóvel) */}
      <button
        type="button"
        onClick={() => onGo(shown - 1)}
        disabled={shown === 0}
        aria-label={`Anterior: ${STORIES[0].label}`}
        className="press absolute left-4 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/30 backdrop-blur-md transition hover:bg-black/50 disabled:pointer-events-none disabled:opacity-0 md:grid"
      >
        <ChevronLeft className="h-6 w-6" />
      </button>
      <button
        type="button"
        onClick={() => onGo(shown + 1)}
        disabled={shown === last}
        aria-label={`Seguinte: ${STORIES[last].label}`}
        className="press absolute right-4 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 place-items-center rounded-full bg-black/30 backdrop-blur-md transition hover:bg-black/50 disabled:pointer-events-none disabled:opacity-0 md:grid"
      >
        <ChevronRight className="h-6 w-6" />
      </button>
    </div>
  )
}

function Panel({ story, active, labelledBy, children }: { story: (typeof STORIES)[number]; active: boolean; labelledBy: string; children: ReactNode }) {
  const shade = useRef<HTMLDivElement>(null)
  // Escurece o fundo à medida que o conteúdo sobe, para manter a leitura sobre a fotografia.
  const onScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget
    if (shade.current) shade.current.style.opacity = String(Math.min(1, el.scrollTop / (el.clientHeight * 0.4)))
  }
  return (
    <section
      className="relative h-full w-1/2 overflow-hidden"
      aria-labelledby={labelledBy}
      aria-hidden={!active}
      inert={!active}
      data-story-panel={story.id}
    >
      <ArtImage art={story.art} />
      <div className={cx('absolute inset-0 bg-gradient-to-t to-black/10', story.tint)} aria-hidden />
      <div ref={shade} className="absolute inset-0 bg-[#081723]/80 opacity-0" aria-hidden />
      <div className="absolute inset-0 overflow-y-auto overscroll-contain" onScroll={onScroll}>
        <div data-panel-content className="px-5 pb-[calc(env(safe-area-inset-bottom)+2.5rem)] pt-[calc(env(safe-area-inset-top)+96px)] sm:px-8 md:px-24">
          {children}
        </div>
      </div>
    </section>
  )
}
