import { ExternalLink } from 'lucide-react'
import type { PhotoAsset } from '../../data/photos/types'
import { capturedLabel, isStock } from '../../lib/photos/rules'
import { Sheet } from '../Dialog'

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 border-b border-line py-3 last:border-0">
      <dt className="text-[11.5px] font-bold uppercase tracking-wider text-subtle">{label}</dt>
      <dd className="text-[14px] text-ink">{children}</dd>
    </div>
  )
}

const ext = (url: string, text: string) => (
  <a href={url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-teal-700 hover:underline">
    {text}
    <ExternalLink className="h-3.5 w-3.5" aria-hidden />
  </a>
)

/** Autor, fonte, licença, data de captação e alterações da fotografia. */
export function PhotoCredits({ asset, open, onClose }: { asset: PhotoAsset; open: boolean; onClose: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Sobre esta fotografia">
      <dl>
        <Row label="Autor">{asset.authorUrl ? ext(asset.authorUrl, asset.author) : asset.author}</Row>
        <Row label="Licença">{asset.license.url ? ext(asset.license.url, asset.license.name) : asset.license.name}</Row>
        <Row label="Fonte">{ext(asset.sourcePageUrl, asset.provider === 'wikimedia-commons' ? 'Wikimedia Commons' : asset.provider === 'unsplash' ? 'Unsplash' : 'Página de origem')}</Row>
        <Row label="Data de captação">{capturedLabel(asset)}</Row>
        <Row label="Atribuição">{asset.attribution}</Row>
        <Row label="Alterações">{asset.changes}</Row>
        {isStock(asset) ? (
          <Row label="O que mostra">{asset.identityBasis}</Row>
        ) : (
          <Row label="Verificação do local">
            {asset.identityMethod === 'humana' ? 'Revista por pessoa' : 'Verificação automática'} · {asset.identityBasis}
          </Row>
        )}
      </dl>
      <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
        {isStock(asset)
          ? 'Fotografia de banco de imagens, usada para ilustrar a ficha. Não representa as condições atuais da albufeira.'
          : 'A fotografia mostra o setor e o momento em que foi captada. Não representa as condições atuais da albufeira.'}
      </p>
    </Sheet>
  )
}
