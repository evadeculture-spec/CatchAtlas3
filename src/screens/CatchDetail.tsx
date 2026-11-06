import { CalendarDays, Globe, Lock, MapPin, Medal, Pencil, Ruler, Scale, Trash2, Waves, Fish, Sparkles } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { Avatar, CatchVisual, useAnglerName } from '../components/bits'
import { ConfirmSheet } from '../components/Dialog'
import { ButtonLink, Card, IconButton, PageHeader, Tag } from '../components/ui'
import { DEMO_USER_ID } from '../data/anglers'
import { speciesById } from '../data/catalog'
import { damById } from '../data/dams'
import { formatDateLong, formatKg } from '../lib/format'
import { computeRanking, isRankingEligible } from '../lib/ranking'
import { useApp } from '../state/AppState'
import { useToast } from '../state/Toasts'
import NotFound from './NotFound'

export default function CatchDetail() {
  const { id } = useParams()
  const { state, allCatches, deleteCatch } = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const anglerName = useAnglerName()
  const [confirm, setConfirm] = useState(false)
  const c = allCatches.find((x) => x.id === id)
  if (!c || (c.visibility === 'privada' && c.anglerId !== DEMO_USER_ID)) return <NotFound />
  const own = c.anglerId === DEMO_USER_ID
  const sp = speciesById[c.speciesId]
  const dam = damById[c.damId]
  const eligible = isRankingEligible(c)
  const ranking = computeRanking(allCatches, { species: c.speciesId, damId: 'todas', period: 'sempre', mode: 'maior', ref: state.anchor })
  const pos = ranking.findIndex((r) => r.anglerId === c.anglerId && r.best.id === c.id)
  const mineSameSpecies = state.myCatches.filter((x) => x.speciesId === c.speciesId)
  const isPersonalBest = own && mineSameSpecies.every((x) => x.weightG <= c.weightG)

  const facts = [
    { icon: Scale, label: 'Peso', value: formatKg(c.weightG) },
    { icon: Ruler, label: 'Comprimento', value: c.lengthCm ? `${c.lengthCm} cm` : '—' },
    { icon: CalendarDays, label: 'Data', value: formatDateLong(c.date) },
    { icon: Waves, label: 'Técnica', value: c.technique || '—' },
    { icon: Fish, label: 'Amostra / isco', value: c.lure || '—' },
  ]

  return (
    <div>
      <PageHeader
        back={own ? '/capturas' : '/'}
        title={sp.name}
        eyebrow={own ? 'A tua captura' : `Captura de ${anglerName(c.anglerId)}`}
        actions={
          own && (
            <>
              <IconButton icon={Pencil} label="Editar captura" tone="plain" onClick={() => navigate(`/capturas/${c.id}/editar`)} />
              <IconButton icon={Trash2} label="Eliminar captura" tone="plain" onClick={() => setConfirm(true)} />
            </>
          )
        }
      />
      <div className="mx-auto max-w-5xl px-4 pt-4 lg:px-8">
        <div className="grid gap-5 lg:grid-cols-[1.1fr_1fr]">
          <div className="relative overflow-hidden rounded-[28px] bg-ink shadow-lift">
            <div className="aspect-[4/3] lg:aspect-[4/5]">
              <CatchVisual c={c} iconSize={72} />
            </div>
            {!c.hasPhoto && <span className="absolute bottom-3 left-3 rounded-full bg-black/30 px-2.5 py-1 text-[11px] font-bold text-white/85 backdrop-blur">Sem fotografia · cartão gráfico</span>}
            {isPersonalBest && (
              <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-amber px-2.5 py-1 text-[12px] font-extrabold text-ink">
                <Sparkles className="h-3.5 w-3.5" aria-hidden /> Recorde pessoal
              </span>
            )}
          </div>

          <div className="space-y-4">
            <div>
              <div className="flex flex-wrap gap-1.5">
                {c.released && <Tag tone="teal">Libertada</Tag>}
                <Tag>
                  {c.visibility === 'publica' ? <Globe className="h-3 w-3" aria-hidden /> : <Lock className="h-3 w-3" aria-hidden />}
                  {c.visibility === 'publica' ? 'Pública' : 'Privada'}
                </Tag>
                {!own && <Tag tone="amber">Perfil fictício</Tag>}
              </div>
              <p className="tnum font-display mt-3 text-[52px] font-semibold leading-none text-ink">{formatKg(c.weightG)}</p>
              <Link to={`/barragens/${dam.id}`} className="mt-2 inline-flex items-center gap-1.5 text-[15px] font-bold text-teal-700 hover:underline">
                <MapPin className="h-4 w-4" aria-hidden /> {dam.name}
              </Link>
              {!own && (
                <p className="mt-3 flex items-center gap-2 text-[14px] font-semibold text-muted">
                  <Avatar anglerId={c.anglerId} size={28} /> {anglerName(c.anglerId)}
                </p>
              )}
            </div>

            <Card className="divide-y divide-line">
              {facts.map((f) => (
                <div key={f.label} className="flex items-center justify-between gap-4 px-5 py-3.5">
                  <span className="flex items-center gap-2.5 text-[13.5px] font-semibold text-muted">
                    <f.icon className="h-4 w-4" aria-hidden />
                    {f.label}
                  </span>
                  <span className="tnum text-right text-[14px] font-bold text-ink">{f.value}</span>
                </div>
              ))}
            </Card>

            {c.notes && (
              <Card className="p-5">
                <p className="text-[12px] font-bold uppercase tracking-wider text-subtle">Notas</p>
                <p className="mt-1.5 text-[14.5px] leading-relaxed text-ink">{c.notes}</p>
              </Card>
            )}

            <Card className="flex items-center gap-4 p-5">
              <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-ink text-amber">
                <Medal className="h-6 w-6" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                {eligible && pos >= 0 ? (
                  <>
                    <p className="font-extrabold text-ink">{pos + 1}.º no ranking de {sp.name}</p>
                    <p className="text-[12.5px] text-muted">Maior captura · todas as barragens · sempre (demonstração)</p>
                  </>
                ) : eligible ? (
                  <>
                    <p className="font-extrabold text-ink">Elegível para o ranking</p>
                    <p className="text-[12.5px] text-muted">Conta para o peso acumulado; há uma captura maior do mesmo pescador.</p>
                  </>
                ) : (
                  <>
                    <p className="font-extrabold text-ink">Fora do ranking</p>
                    <p className="text-[12.5px] text-muted">{c.visibility === 'privada' ? 'Capturas privadas não entram no ranking.' : 'Participação no ranking desativada.'}</p>
                  </>
                )}
              </div>
              <ButtonLink to={`/rankings?especie=${c.speciesId}`} size="sm" variant="outline">
                Ver
              </ButtonLink>
            </Card>
          </div>
        </div>
      </div>
      <ConfirmSheet
        open={confirm}
        onClose={() => setConfirm(false)}
        title="Eliminar captura?"
        text="A captura e a fotografia serão removidas deste navegador. As estatísticas e o ranking são atualizados."
        confirmLabel="Eliminar"
        danger
        onConfirm={() => {
          deleteCatch(c.id)
          toast('Captura eliminada', { tone: 'info' })
          navigate('/capturas', { replace: true })
        }}
      />
    </div>
  )
}
