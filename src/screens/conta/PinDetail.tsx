import { Archive, ArchiveRestore, CalendarPlus, Navigation, Pencil, Radio, Star, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { ConfirmSheet } from '../../components/Dialog'
import { Button, ButtonLink, EmptyState, IconButton, PageHeader, Tag } from '../../components/ui'
import { PingRow } from '../../components/lanca/cards'
import { PrivateMap } from '../../components/lanca/PrivateMap'
import { ErrorBox, KV, ListSkeleton, Panel, useLoad } from '../../components/lanca/primitives'
import { SignedImage } from '../../components/lanca/SignedImage'
import { deletePin, friendly, getPin, listJourneys, listPings, updatePin } from '../../lib/lanca/api'
import { analyse, isSession, isSuccess, MIN_SAMPLE } from '../../lib/lanca/intelligence'
import { environmentLabel, JOURNEY_STATUS, modalityLabel, pinCategory } from '../../lib/lanca/labels'
import { formatCoords } from '../../lib/lanca/geo'
import { formatDay } from '../../lib/lanca/time'
import { fmt } from '../../lib/lanca/units'
import { useAuth } from '../../state/Auth'
import { useToast } from '../../state/Toasts'

export default function PinDetail() {
  const { id } = useParams()
  const nav = useNavigate()
  const toast = useToast()
  const { units } = useAuth()
  const { data, error, loading, reload, setData } = useLoad(async () => {
    const [pin, pings, journeys] = await Promise.all([getPin(id!), listPings({ pinId: id }), listJourneys()])
    return { pin, pings, journeys: journeys.filter((j) => j.journey_pins.some((jp) => jp.pin_id === id)) }
  }, [id])
  const [confirmDel, setConfirmDel] = useState(false)
  const [busy, setBusy] = useState(false)
  const report = useMemo(() => (data ? analyse(data.pings) : null), [data])

  if (error) return <ErrorBox message={error} onRetry={reload} />
  if (loading || !data || !report) return <ListSkeleton />
  const { pin, pings, journeys } = data
  const cat = pinCategory(pin.category)
  const sessions = pings.filter(isSession)
  const catchPings = pings.filter((p) => isSuccess(p))
  const photos = pings.flatMap((p) => p.ping_media.map((m) => ({ m, ping: p }))).slice(0, 12)
  const temps = catchPings.map((p) => p.ping_environment?.air_temp_c).filter((t): t is number => t != null).sort((a, b) => a - b)

  const patch = async (p: Parameters<typeof updatePin>[1], msg: string) => {
    setBusy(true)
    try {
      const updated = await updatePin(pin.id, p)
      setData({ ...data, pin: updated })
      toast(msg)
    } catch (e) {
      toast(friendly(e), { tone: 'warning' })
    } finally {
      setBusy(false)
    }
  }
  const remove = async () => {
    setBusy(true)
    try {
      await deletePin(pin.id)
      toast('Pin apagado', { detail: pings.length ? `Os ${pings.length} pings foram mantidos, sem local associado.` : undefined })
      nav('/conta/pins', { replace: true })
    } catch (e) {
      toast(friendly(e), { tone: 'warning' })
      setBusy(false)
    }
  }

  return (
    <div className="-mx-4 -mt-5 lg:-mx-8">
      <PageHeader
        title={pin.name}
        eyebrow={cat.label}
        back="/conta/pins"
        actions={
          <>
            <IconButton icon={Star} label={pin.is_favorite ? 'Retirar dos favoritos' : 'Marcar como favorito'} active={pin.is_favorite} tone="plain" className={pin.is_favorite ? 'text-amber' : ''} onClick={() => patch({ is_favorite: !pin.is_favorite }, pin.is_favorite ? 'Retirado dos favoritos' : 'Marcado como favorito')} />
            <ButtonLink to={`/conta/pins/${pin.id}/editar`} size="sm" variant="outline" icon={Pencil}>
              Editar
            </ButtonLink>
          </>
        }
      />
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 py-5 lg:grid-cols-[1.1fr_1fr] lg:px-8">
        <div className="space-y-4">
          <div className="relative h-64 overflow-hidden rounded-[var(--radius-card)] shadow-card sm:h-80">
            <PrivateMap pins={[pin]} pings={pings.filter((p) => p.lat != null).map((p) => ({ id: p.id, lat: p.lat!, lng: p.lng!, kind: p.kind, occurred_at: p.occurred_at }))} className="absolute inset-0" label={`Mapa do Pin ${pin.name}`} onSelect={(s) => s?.type === 'ping' && nav(`/conta/pings/${s.id}`)} />
          </div>
          <div className="flex flex-wrap gap-2">
            <ButtonLink to={`/conta/pings/novo?pin=${pin.id}`} icon={Radio}>
              Novo Ping aqui
            </ButtonLink>
            <ButtonLink to={`/conta/jornadas/nova?pin=${pin.id}`} variant="outline" icon={CalendarPlus}>
              Planear jornada
            </ButtonLink>
            <a href={`https://www.google.com/maps/dir/?api=1&destination=${pin.lat},${pin.lng}`} target="_blank" rel="noopener noreferrer" className="press inline-flex h-11 items-center gap-2 rounded-full border border-line bg-white px-5 text-sm font-bold text-ink" title="Abre o Google Maps (serviço externo) com as coordenadas deste Pin">
              <Navigation className="h-[18px] w-[18px]" aria-hidden /> Navegar
            </a>
          </div>

          <Panel title="Histórico deste local" kicker="Dados reais">
            <div className="grid grid-cols-4 gap-2 text-center">
              {[
                ['Pings', pings.length],
                ['Sessões', sessions.length],
                ['Capturas', pings.reduce((s, p) => s + p.catches.length, 0)],
                ['Jornadas', journeys.length],
              ].map(([l, v]) => (
                <div key={l} className="rounded-2xl bg-mist px-1 py-2.5">
                  <p className="tnum text-[20px] font-extrabold text-ink">{v}</p>
                  <p className="text-[11.5px] font-bold text-muted">{l}</p>
                </div>
              ))}
            </div>
            {report.bySpecies.length > 0 && (
              <p className="mt-3 text-[13px] text-muted">
                Espécies registadas: {report.bySpecies.map((s) => `${s.species} (${s.count})`).join(', ')}.
              </p>
            )}
            {sessions.length > 0 && (
              <div className="mt-3 space-y-1 text-[13px] text-muted">
                <p>
                  Épocas: {report.bySeason.map((b) => `${b.label.split(' ')[0]} ${b.successes}/${b.n}`).join(' · ')} <span className="text-subtle">(sessões com sucesso / sessões)</span>
                </p>
                {temps.length > 0 && (
                  <p>
                    Temperatura do ar nas sessões com captura: {temps.length === 1 ? fmt.temp(temps[0], units) : `${fmt.temp(temps[0], units)} a ${fmt.temp(temps[temps.length - 1], units)}`} (n = {temps.length}
                    {temps.length < MIN_SAMPLE ? ', amostra pequena' : ''}).
                  </p>
                )}
              </div>
            )}
            {sessions.length === 0 && <p className="mt-3 text-[13px] text-muted">Ainda não há sessões de pesca registadas neste local.</p>}
          </Panel>

          {photos.length > 0 && (
            <Panel title="Fotografias">
              <ul className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {photos.map(({ m, ping }) => (
                  <li key={m.id}>
                    <Link to={`/conta/pings/${ping.id}`} className="block overflow-hidden rounded-xl">
                      <SignedImage path={m.thumb_path} fallbackPath={m.display_path} alt="Fotografia do Ping" className="aspect-square w-full" />
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
        </div>

        <div className="space-y-4">
          <Panel title="Pings neste local" actions={<Tag>{pings.length}</Tag>}>
            {pings.length === 0 ? (
              <EmptyState icon={Radio} title="Sem Pings" text="Registe a primeira experiência neste local." action={<ButtonLink to={`/conta/pings/novo?pin=${pin.id}`} icon={Radio}>Novo Ping</ButtonLink>} />
            ) : (
              <ul className="space-y-2">
                {pings.slice(0, 20).map((p) => (
                  <li key={p.id}>
                    <PingRow ping={p} units={units} />
                  </li>
                ))}
              </ul>
            )}
          </Panel>
          {journeys.length > 0 && (
            <Panel title="Jornadas com este Pin">
              <ul className="space-y-1.5">
                {journeys.map((j) => (
                  <li key={j.id}>
                    <Link to={`/conta/jornadas/${j.id}`} className="flex items-center justify-between gap-2 rounded-xl px-2 py-2 hover:bg-mist">
                      <span className="truncate text-[14px] font-bold text-ink">{j.title}</span>
                      <span className="shrink-0 text-[12px] text-muted">
                        {formatDay(j.journey_date)} · {JOURNEY_STATUS[j.status]}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </Panel>
          )}
          <Panel title="Ficha do local">
            <dl>
              <KV label="Coordenadas" value={formatCoords(pin.lat, pin.lng)} />
              <KV label="Precisão" value={pin.accuracy_m != null ? `±${pin.accuracy_m} m` : null} />
              <KV label="Origem" value={{ gps: 'GPS', mapa: 'Mapa', foto: 'Fotografia', manual: 'Manual', ping: 'A partir de um Ping' }[pin.coord_source]} />
              <KV label="Água" value={pin.water_body_name} />
              <KV label="Ambiente" value={pin.environment ? environmentLabel(pin.environment) : null} />
              <KV label="Espécies-alvo" value={pin.target_species.join(', ') || null} />
              <KV label="Modalidades" value={pin.modalities.map(modalityLabel).join(', ') || null} />
              <KV label="Técnicas" value={pin.techniques.join(', ') || null} />
              <KV label="Iscos" value={pin.baits.join(', ') || null} />
              <KV label="Profundidade" value={pin.depth_m != null ? `${fmt.num(pin.depth_m)} m` : null} />
              <KV label="Fundo" value={pin.bottom_type} />
            </dl>
            {pin.access_notes && <p className="mt-3 text-[13.5px] text-text"><strong>Acesso:</strong> {pin.access_notes}</p>}
            {pin.description && <p className="mt-2 whitespace-pre-line text-[13.5px] text-text">{pin.description}</p>}
            {pin.private_notes && <p className="mt-2 whitespace-pre-line rounded-2xl bg-amber-50 p-3 text-[13px] text-amber-800">{pin.private_notes}</p>}
            {pin.tags.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {pin.tags.map((t) => (
                  <Tag key={t}>{t}</Tag>
                ))}
              </div>
            )}
          </Panel>
          <div className="flex flex-wrap gap-2">
            {pin.status === 'ativo' ? (
              <Button variant="outline" icon={Archive} disabled={busy} onClick={() => patch({ status: 'arquivado' }, 'Pin arquivado')}>
                Arquivar
              </Button>
            ) : (
              <Button variant="outline" icon={ArchiveRestore} disabled={busy} onClick={() => patch({ status: 'ativo' }, 'Pin reativado')}>
                Reativar
              </Button>
            )}
            <Button variant="ghost" icon={Trash2} className="text-danger" disabled={busy} onClick={() => setConfirmDel(true)}>
              Apagar
            </Button>
          </div>
        </div>
      </div>
      <ConfirmSheet
        open={confirmDel}
        onClose={() => setConfirmDel(false)}
        onConfirm={remove}
        danger
        title="Apagar este Pin?"
        confirmLabel="Apagar Pin"
        text={`O Pin "${pin.name}" é apagado definitivamente.${pings.length ? ` Os ${pings.length} pings e as suas fotografias são mantidos, sem local associado.` : ''}${journeys.length ? ` Sai das ${journeys.length} jornadas onde estava.` : ''} Se só quer escondê-lo, use Arquivar.`}
      />
    </div>
  )
}
