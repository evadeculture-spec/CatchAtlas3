import { Bookmark, BookmarkCheck, CalendarDays, Clock, Info, MapPin, Medal, Users } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router'
import { DamCover } from '../components/photo/DamCover'
import { Sheet } from '../components/Dialog'
import { Button, Card, cx, PageHeader, Tag } from '../components/ui'
import { modalityName, speciesById } from '../data/catalog'
import { damById } from '../data/dams'
import { eventById } from '../data/events'
import { addDaysISO } from '../lib/dates'
import { formatDateLong, formatKg, relativeDay } from '../lib/format'
import { useApp } from '../state/AppState'
import { useToast } from '../state/Toasts'
import NotFound from './NotFound'

export default function EventDetail() {
  const { id = '' } = useParams()
  const ev = eventById[id]
  const { state, toggleSavedEvent } = useApp()
  const toast = useToast()
  const [info, setInfo] = useState(false)
  if (!ev) return <NotFound />
  const dam = damById[ev.damId]
  const date = addDaysISO(state.anchor, ev.dayOffset)
  const past = ev.dayOffset < 0
  const saved = state.savedEvents.includes(ev.id)
  const onSave = () => {
    const added = toggleSavedEvent(ev.id)
    toast(added ? 'Prova guardada' : 'Prova removida das guardadas', { tone: added ? 'success' : 'info', detail: added ? 'Encontra-a no Perfil e no filtro “Guardadas”.' : undefined })
  }

  return (
    <div>
      <PageHeader back="/provas" transparent />
      <div className="relative h-[42dvh] max-h-[420px] min-h-[300px] overflow-hidden bg-ink lg:mx-8 lg:mt-6 lg:h-[360px] lg:min-h-0 lg:rounded-[28px]">
        <DamCover dam={dam} variant="hero" sizes="100vw" priority fallback={{ labelClass: "right-4 top-[4.5rem] px-2.5 py-1 text-[11px] lg:top-6 lg:right-6" }} />
        <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-ink/25" />
        <div className="absolute inset-x-0 bottom-0 mx-auto max-w-5xl px-4 pb-6 text-white lg:px-8">
          <div className="flex flex-wrap gap-1.5">
            <Tag tone="amber">Evento fictício — demonstração</Tag>
          </div>
          <h1 className="font-display mt-3 text-[36px] font-semibold leading-[1.05] sm:text-[48px]">{ev.title}</h1>
          <p className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[14px] font-semibold text-white/85">
            <span className="flex items-center gap-1.5"><CalendarDays className="h-4 w-4 text-teal" aria-hidden />{formatDateLong(date)}</span>
            <span className="flex items-center gap-1.5"><MapPin className="h-4 w-4 text-teal" aria-hidden />{dam.name}</span>
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-4 pt-5 lg:px-8">
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
          <div className="space-y-4">
            <Card className="p-5">
              <div className="flex flex-wrap gap-1.5">
                <Tag tone="ink">{modalityName(ev.modality)}</Tag>
                {ev.speciesFocus.map((s) => (
                  <Tag key={s} tone="teal">{speciesById[s].name}</Tag>
                ))}
                <Tag>{past ? 'Concluída' : relativeDay(date, state.anchor)}</Tag>
              </div>
              <p className="mt-4 text-[15px] leading-relaxed text-text">{ev.description}</p>
              <dl className="mt-5 space-y-3 border-t border-line pt-4 text-[14px]">
                <div className="flex gap-3">
                  <dt className="flex w-28 shrink-0 items-center gap-2 font-semibold text-muted"><Users className="h-4 w-4" aria-hidden />Organizador</dt>
                  <dd className="font-bold text-ink">{ev.organizer}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="flex w-28 shrink-0 items-center gap-2 font-semibold text-muted"><Medal className="h-4 w-4" aria-hidden />Formato</dt>
                  <dd className="font-bold text-ink">{ev.format}</dd>
                </div>
                <div className="flex gap-3">
                  <dt className="flex w-28 shrink-0 items-center gap-2 font-semibold text-muted"><MapPin className="h-4 w-4" aria-hidden />Local</dt>
                  <dd>
                    <Link to={`/barragens/${dam.id}`} className="font-bold text-teal-700 hover:underline">{dam.name}</Link>
                    <span className="text-muted"> · {dam.place}</span>
                  </dd>
                </div>
              </dl>
            </Card>

            {past && ev.results && (
              <Card className="overflow-hidden">
                <div className="flex items-center justify-between px-5 pt-5">
                  <h2 className="text-[15px] font-extrabold text-ink">Resultados da prova</h2>
                  <Tag tone="amber">Fictícios</Tag>
                </div>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full min-w-[420px] text-left text-[13.5px]">
                    <thead>
                      <tr className="border-b border-line text-[11.5px] font-bold uppercase tracking-wider text-subtle">
                        <th className="px-5 py-2.5">#</th>
                        <th className="py-2.5">Participante</th>
                        <th className="py-2.5 text-right">Exempl.</th>
                        <th className="py-2.5 text-right">Maior</th>
                        <th className="px-5 py-2.5 text-right">Total</th>
                      </tr>
                    </thead>
                    <tbody className="tnum">
                      {ev.results.map((r, i) => (
                        <tr key={r.name} className={cx('border-b border-line last:border-0', i === 0 && 'bg-amber-50/60')}>
                          <td className={cx('px-5 py-3 font-extrabold', i < 3 ? 'text-amber-800' : 'text-muted')}>{i + 1}</td>
                          <td className="py-3 font-bold text-ink">{r.name}</td>
                          <td className="py-3 text-right text-muted">{r.catches}</td>
                          <td className="py-3 text-right text-muted">{formatKg(r.biggestG)}</td>
                          <td className="px-5 py-3 text-right font-extrabold text-ink">{formatKg(r.weightG)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="px-5 py-3 text-[12px] text-muted">Resultados de prova, separados do ranking comunitário.</p>
              </Card>
            )}
          </div>

          <div className="space-y-4">
            <Card className="p-5">
              <h2 className="text-[15px] font-extrabold text-ink">Programa</h2>
              <ol className="mt-3 space-y-0">
                {ev.schedule.map((s, i) => (
                  <li key={s.time} className="relative flex gap-4 pb-4 last:pb-0">
                    {i < ev.schedule.length - 1 && <span className="absolute left-[7px] top-5 h-full w-0.5 bg-line" aria-hidden />}
                    <span className={cx('relative mt-1 h-4 w-4 shrink-0 rounded-full border-[3px]', i === 0 ? 'border-teal bg-white' : 'border-line bg-white')} aria-hidden />
                    <div>
                      <p className="tnum flex items-center gap-1.5 text-[13px] font-extrabold text-ink"><Clock className="h-3.5 w-3.5 text-muted" aria-hidden />{s.time}</p>
                      <p className="text-[13.5px] text-muted">{s.label}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </Card>
            <div className="flex flex-col gap-2.5 sm:flex-row lg:flex-col">
              <Button size="lg" variant={saved ? 'outline' : 'dark'} icon={saved ? BookmarkCheck : Bookmark} onClick={onSave} className="sm:flex-1 lg:flex-none" aria-pressed={saved}>
                {saved ? 'Prova guardada' : 'Guardar prova'}
              </Button>
              {!past && (
                <Button size="lg" variant="soft" icon={Info} onClick={() => setInfo(true)} className="sm:flex-1 lg:flex-none">
                  Sobre inscrições
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <Sheet open={info} onClose={() => setInfo(false)} title="Inscrições não disponíveis" footer={<Button className="w-full" variant="dark" onClick={() => setInfo(false)}>Percebi</Button>}>
        <p className="text-[14.5px] leading-relaxed text-muted">
          Esta prova é fictícia e serve apenas para mostrar como o calendário funcionaria. No produto real, a inscrição seria feita junto do organizador ou através de um fluxo próprio, ainda por definir.
        </p>
      </Sheet>
    </div>
  )
}
