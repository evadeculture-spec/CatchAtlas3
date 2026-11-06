import { ExternalLink, X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { ATLAS_CONFIG } from '../../lib/atlas/config'
import type { AtlasSource } from '../../lib/atlas/model'

const fmtDate = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString('pt-PT', { day: 'numeric', month: 'long', year: 'numeric' })

/** Fontes, licenças, datas e cobertura (atribuição sempre acessível, também sem mapa). */
export function SourcesDialog({ open, onClose, sources }: { open: boolean; onClose: () => void; sources: Record<string, AtlasSource> | null }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const d = ref.current
    if (!d) return
    if (open && !d.open) d.showModal()
    if (!open && d.open) d.close()
  }, [open])
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="atlas-sources-h"
      className="m-auto max-h-[86dvh] w-[min(560px,calc(100vw-24px))] overflow-y-auto overscroll-contain rounded-3xl border border-white/10 bg-[#0a2230] p-5 text-[#f4f7f8] backdrop:bg-black/60"
      data-no-swipe
    >
      <div className="flex items-start justify-between gap-3">
        <h2 id="atlas-sources-h" className="font-display text-[22px] font-semibold">Fontes e cobertura</h2>
        <button type="button" onClick={onClose} aria-label="Fechar" className="press grid h-10 w-10 shrink-0 place-items-center rounded-full hover:bg-white/10">
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>
      <ul className="mt-3 grid gap-3 text-[13px] leading-relaxed text-[#b5c5cc]">
        {sources
          ? Object.values(sources).map((s) => (
              <li key={s.key}>
                <p className="font-bold text-[#f4f7f8]">{s.name}</p>
                <p>
                  {s.license} · {s.attribution} · {s.observedAt ? `dados de ${fmtDate(s.observedAt)}` : s.version ? `versão ${s.version}` : 'sem data publicada'} · processado em {fmtDate(s.processedAt)}
                </p>
                {s.notes && <p className="text-[12px] text-[#b5c5cc]/80">{s.notes}</p>}
                {s.url && (
                  <a href={s.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-[#83e5ef] hover:underline">
                    Fonte <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
              </li>
            ))
          : null}
        <li>
          <p className="font-bold text-[#f4f7f8]">Laje peninsular, contexto e regiões</p>
          <p>Natural Earth 10 m (domínio público), versão 5.2.0-pre. A espessura da peça é uma representação gráfica, não um modelo geológico ou batimétrico.</p>
        </li>
        <li>
          <p className="font-bold text-[#f4f7f8]">Relevo</p>
          <p dangerouslySetInnerHTML={{ __html: ATLAS_CONFIG.dem.enabled ? ATLAS_CONFIG.dem.attribution : 'Desligado nesta instalação.' }} />
          <p className="text-[12px] text-[#b5c5cc]/80">Só relevo terrestre: a profundidade do mar é removida e não há batimetria das albufeiras.</p>
        </li>
        <li>
          <p className="font-bold text-[#f4f7f8]">Mapa base</p>
          <p>OpenFreeMap · © OpenMapTiles · dados © contribuidores do OpenStreetMap (ODbL). Se não carregar, o atlas usa a base Natural Earth.</p>
        </li>
      </ul>
      <p className="mt-4 rounded-2xl bg-white/5 p-3 text-[12.5px] leading-relaxed text-[#b5c5cc]">
        Âmbito: Portugal continental e Espanha peninsular no enquadramento inicial. Os registos insulares e de Ceuta e Melilla que já existiam nos dados mantêm-se pesquisáveis. O Atlas não contém “todas as massas de água”: a auditoria de cobertura está em docs/atlas/COBERTURA.md.
      </p>
    </dialog>
  )
}
