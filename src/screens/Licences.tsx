import { Info } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { ExploreTabs } from '../components/ExploreTabs'
import { ConfidenceTag, SourceLink } from '../components/SourceLink'
import { Card, Segmented } from '../components/ui'
import { LEGAL, LEGAL_CHECKED_AT } from '../data/legal'
import type { CountryId } from '../data/types'
import { formatDateLong } from '../lib/format'

export default function Licences() {
  const [params, setParams] = useSearchParams()
  const country: CountryId = params.get('pais') === 'ES' ? 'ES' : 'PT'
  return (
    <div className="mx-auto max-w-4xl px-4 lg:px-8">
      <header className="pt-safe pt-5 lg:pt-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-teal-700">Explorar</p>
        <h1 className="font-display mt-1 text-[30px] font-semibold leading-tight text-ink sm:text-[36px]">Licenças e legislação</h1>
        <div className="mt-4">
          <ExploreTabs />
        </div>
      </header>

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
        <Segmented
          label="País"
          value={country}
          onChange={(v) => setParams(v === 'ES' ? { pais: 'ES' } : {}, { replace: true })}
          options={[
            { id: 'PT', label: 'Portugal' },
            { id: 'ES', label: 'Espanha' },
          ]}
        />
        <p className="text-[12.5px] font-semibold text-muted">Compilado a {formatDateLong(LEGAL_CHECKED_AT).toLowerCase()}</p>
      </div>

      <div className="mt-4 flex gap-3 rounded-[var(--radius-card)] bg-amber-50 p-4 text-[13px] leading-relaxed text-amber-800">
        <Info className="mt-0.5 h-5 w-5 shrink-0" aria-hidden />
        <p>
          Resumo informativo com as fontes indicadas. Não substitui os diplomas, editais e ordens de pesca. As regras locais (concessões, zonas de pesca, cotos) prevalecem e mudam todos os anos: confirme sempre antes de pescar.
        </p>
      </div>

      <div className="mt-5 space-y-6">
        {LEGAL[country].map((sec) => (
          <section key={sec.id}>
            <h2 className="mb-3 text-lg font-extrabold text-ink">{sec.title}</h2>
            <div className="space-y-3">
              {sec.items.map((it) => (
                <Card key={it.title} className="p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <h3 className="min-w-0 flex-1 text-[15px] font-extrabold text-ink">{it.title}</h3>
                    <ConfidenceTag c={it.confidence} />
                  </div>
                  <p className="mt-2 text-[14px] leading-relaxed text-text">{it.text}</p>
                  {it.sources.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-1.5">
                      {it.sources.map((s) => (
                        <SourceLink key={s.url} {...s} />
                      ))}
                    </div>
                  )}
                </Card>
              ))}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
