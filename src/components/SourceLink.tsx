import { ExternalLink } from 'lucide-react'
import { CONFIDENCE_LABEL, type Confidence } from '../data/legal'
import { cx } from './ui'

export function SourceLink({ label, url }: { label: string; url: string }) {
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="press inline-flex items-center gap-1 rounded-full bg-mist px-2.5 py-1 text-[12px] font-bold text-teal-700 hover:bg-teal-50">
      {label}
      <ExternalLink className="h-3 w-3" aria-hidden />
    </a>
  )
}

export function ConfidenceTag({ c }: { c: Confidence }) {
  return (
    <span
      className={cx(
        'inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold',
        c === 'oficial' && 'bg-teal-50 text-teal-700',
        c === 'secundaria' && 'bg-mist text-muted',
        c === 'a-confirmar' && 'bg-amber-50 text-amber-800',
      )}
    >
      {CONFIDENCE_LABEL[c]}
    </span>
  )
}
