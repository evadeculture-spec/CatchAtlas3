import { Eye, Images, Lightbulb } from 'lucide-react'
import { PHOTO_CATALOG } from '../../lib/photos/catalog'
import { NOT_INFERABLE, observationsFor, type DamPhoto } from '../../lib/photos/rules'
import { Button, Card } from '../ui'

/**
 * "O que se vê nesta fotografia": só observações aprovadas desta fotografia exata,
 * separadas das hipóteses e dos limites do que uma imagem permite concluir.
 */
export function PhotoInsights({ cover, onExplore }: { cover: DamPhoto; onExplore: () => void }) {
  const observed = observationsFor(PHOTO_CATALOG, cover.asset, 'observado').slice(0, 3)
  const hypotheses = observationsFor(PHOTO_CATALOG, cover.asset, 'hipotese').slice(0, 2)
  return (
    <Card className="p-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="flex items-center gap-2 text-[15px] font-extrabold text-ink">
          <Eye className="h-4 w-4 text-teal-700" aria-hidden /> O que se vê nesta fotografia
        </h2>
        <Button size="sm" variant="outline" icon={Images} onClick={onExplore}>
          Explorar fotografia
        </Button>
      </div>
      {observed.length > 0 ? (
        <ul className="mt-3 space-y-2">
          {observed.map((o) => (
            <li key={o.id} className="flex gap-2 text-[14px] text-ink">
              <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-teal" aria-hidden />
              {o.text}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-[13.5px] text-muted">Ainda sem observações revistas para esta fotografia.</p>
      )}
      {hypotheses.length > 0 && (
        <div className="mt-4 rounded-2xl bg-amber-50 p-3">
          <p className="flex items-center gap-1.5 text-[12px] font-extrabold uppercase tracking-wider text-amber-800">
            <Lightbulb className="h-3.5 w-3.5" aria-hidden /> Hipóteses para explorar
          </p>
          <ul className="mt-1.5 space-y-1 text-[13.5px] text-amber-800">
            {hypotheses.map((o) => (
              <li key={o.id}>{o.text}</li>
            ))}
          </ul>
        </div>
      )}
      <p className="mt-4 text-[12px] leading-relaxed text-muted">
        <b className="text-ink">Não avaliável numa fotografia:</b> {NOT_INFERABLE.join(', ').toLowerCase()}. As observações referem-se apenas ao setor fotografado.
      </p>
    </Card>
  )
}
