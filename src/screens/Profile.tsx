import { Bookmark, ChevronRight, Crown, Heart, Info, Medal, Pencil, RotateCcw, Route, Smartphone, Check, Radio, ShoppingBag } from 'lucide-react'
import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Avatar } from '../components/bits'
import { ConfirmSheet, Sheet } from '../components/Dialog'
import { InstallSteps } from '../components/InstallTip'
import { Button, Card, Chip, cx, DemoTag, EmptyState, inputCls, SectionHeader, Toggle } from '../components/ui'
import { brand } from '../config/brand'
import { DEMO_USER_ID } from '../data/anglers'
import { MODALITIES, modalityName, REGIONS, regionName, SPECIES, speciesById } from '../data/catalog'
import { damById } from '../data/dams'
import { eventById } from '../data/events'
import { addDaysISO } from '../lib/dates'
import { formatDate, formatKg, formatKgShort } from '../lib/format'
import { useApp } from '../state/AppState'
import { useToast } from '../state/Toasts'

const AVATAR_COLORS = ['#20BFA9', '#F2B544', '#7FB3D5', '#C9A27A', '#A3C585', '#E8A0A0']

export default function Profile() {
  const { state, updateProfile, setPref, resetDemo, setSubscription } = useApp()
  const toast = useToast()
  const navigate = useNavigate()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(state.profile.name)
  const [confirmReset, setConfirmReset] = useState(false)
  const { profile, myCatches } = state
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? (list.length > 1 ? list.filter((x) => x !== v) : list) : [...list, v])

  const records = SPECIES.map((s) => ({ s, best: myCatches.filter((c) => c.speciesId === s.id).sort((a, b) => b.weightG - a.weightG)[0] })).filter((r) => r.best)
  const total = myCatches.reduce((a, c) => a + c.weightG, 0)
  const damsVisited = new Set(myCatches.map((c) => c.damId)).size

  return (
    <div className="mx-auto max-w-5xl px-4 lg:px-8">
      <header className="pt-safe flex items-center justify-between pt-5 lg:pt-8">
        <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-teal-700">Perfil de demonstração</p>
        <DemoTag />
      </header>

      <section className="mt-4 overflow-hidden rounded-[28px] bg-ink p-5 text-white sm:p-6">
        <div className="flex items-center gap-4">
          <Avatar anglerId={DEMO_USER_ID} size={72} />
          <div className="min-w-0 flex-1">
            <h1 className="font-display truncate text-[30px] font-semibold leading-tight">{profile.name}</h1>
            <p className="text-[13.5px] text-white/65">
              {regionName(profile.region)} · {profile.modalities.map(modalityName).join(', ')}
            </p>
          </div>
          <button onClick={() => { setName(profile.name); setEditing(true) }} className="press grid h-11 w-11 place-items-center rounded-full bg-white/10 hover:bg-white/15" aria-label="Editar perfil">
            <Pencil className="h-[18px] w-[18px]" aria-hidden />
          </button>
        </div>
        <dl className="tnum mt-6 grid grid-cols-4 gap-2 border-t border-white/10 pt-5">
          {[
            ['Capturas', myCatches.length],
            ['kg', formatKgShort(total).replace(' kg', '')],
            ['Jornadas', state.trips.length],
            ['Barragens', damsVisited],
          ].map(([l, v]) => (
            <div key={l as string}>
              <dd className="text-[22px] font-extrabold">{v}</dd>
              <dt className="text-[12px] font-semibold text-white/55">{l}</dt>
            </div>
          ))}
        </dl>
      </section>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section>
          <SectionHeader title="Recordes pessoais" to="/rankings" linkLabel="Rankings" />
          {records.length ? (
            <Card className="divide-y divide-line">
              {records.map(({ s, best }) => (
                <Link key={s.id} to={`/capturas/${best!.id}`} className="press flex items-center gap-3 px-4 py-3 hover:bg-mist/60">
                  <span className="grid h-10 w-10 place-items-center rounded-xl" style={{ background: `${s.color}22` }}>
                    <Crown className="h-[18px] w-[18px]" style={{ color: s.color }} aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14.5px] font-extrabold text-ink">{s.name}</span>
                    <span className="block truncate text-[12.5px] text-muted">{damById[best!.damId].name} · {formatDate(best!.date)}</span>
                  </span>
                  <span className="tnum text-[15px] font-extrabold text-ink">{formatKg(best!.weightG)}</span>
                </Link>
              ))}
            </Card>
          ) : (
            <EmptyState icon={Medal} title="Sem recordes ainda" text="Registe capturas para ver aqui os seus melhores exemplares." />
          )}
        </section>

        <section>
          <SectionHeader title="Barragens favoritas" to="/explorar?favoritas=1" />
          {state.favorites.length ? (
            <div className="grid grid-cols-2 gap-2.5">
              {state.favorites.map((f) => damById[f]).filter(Boolean).map((d) => (
                <Link key={d.id} to={`/barragens/${d.id}`} className="press flex items-center gap-2.5 rounded-2xl bg-white p-3 shadow-card hover:shadow-lift">
                  <Heart className="h-4 w-4 shrink-0 fill-amber text-amber" aria-hidden />
                  <span className="truncate text-[14px] font-extrabold text-ink">{d.name}</span>
                </Link>
              ))}
            </div>
          ) : (
            <EmptyState icon={Heart} title="Sem favoritas" text="Toque no coração de uma barragem para a guardar aqui." />
          )}
        </section>

        <section>
          <SectionHeader title="Jornadas guardadas" />
          {state.trips.length ? (
            <Card className="divide-y divide-line">
              {state.trips.map((t) => (
                <Link key={t.id} to={`/jornadas/${t.id}`} className="press flex items-center gap-3 px-4 py-3 hover:bg-mist/60">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-teal-50 text-teal-700">
                    <Route className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-extrabold text-ink">{damById[t.damId].name} · {speciesById[t.speciesId].name}</span>
                    <span className="block truncate text-[12.5px] text-muted">{formatDate(t.date, { weekday: 'short', day: 'numeric', month: 'short' })} · {modalityName(t.modality)}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-subtle" aria-hidden />
                </Link>
              ))}
            </Card>
          ) : (
            <EmptyState icon={Route} title="Nenhuma jornada guardada" text="Prepare uma jornada para ter condições, abordagens e checklist à mão." action={<Button size="sm" onClick={() => navigate('/jornada/nova')}>Preparar jornada</Button>} />
          )}
        </section>

        <section>
          <SectionHeader title="Provas guardadas" to="/provas?guardadas=1" />
          {state.savedEvents.length ? (
            <Card className="divide-y divide-line">
              {state.savedEvents.map((id) => eventById[id]).filter(Boolean).map((e) => (
                <Link key={e.id} to={`/provas/${e.id}`} className="press flex items-center gap-3 px-4 py-3 hover:bg-mist/60">
                  <span className="grid h-10 w-10 place-items-center rounded-xl bg-amber-50 text-amber-800">
                    <Bookmark className="h-[18px] w-[18px]" aria-hidden />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-extrabold text-ink">{e.title}</span>
                    <span className="block truncate text-[12.5px] text-muted">{damById[e.damId].name} · {formatDate(addDaysISO(state.anchor, e.dayOffset))}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-subtle" aria-hidden />
                </Link>
              ))}
            </Card>
          ) : (
            <EmptyState icon={Bookmark} title="Nenhuma prova guardada" text="Guarde provas do calendário para as acompanhar." action={<Button size="sm" variant="dark" onClick={() => navigate('/provas')}>Ver provas</Button>} />
          )}
        </section>

        <section>
          <SectionHeader title="Subscrição e comunidade" to="/comunidade" linkLabel="Comunidade" />
          <Card className="space-y-4 p-5">
            <div className="flex items-center gap-3">
              <span className={cx('grid h-11 w-11 place-items-center rounded-2xl', state.subscription.active ? 'bg-amber text-ink' : 'bg-mist text-muted')}>
                <Crown className="h-5 w-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-[14.5px] font-extrabold text-ink">{brand.subscription.name}</p>
                <p className="text-[12.5px] text-muted">
                  {state.subscription.active ? `Ativa desde ${formatDate(state.subscription.since ?? state.anchor)} · simulação, sem pagamentos` : 'Inativa · dá acesso ao chat global'}
                </p>
              </div>
              {state.subscription.active ? (
                <Button size="sm" variant="outline" onClick={() => { setSubscription(false); toast('Subscrição de demonstração cancelada', { tone: 'info' }) }}>
                  Cancelar
                </Button>
              ) : (
                <Button size="sm" variant="dark" onClick={() => navigate('/comunidade/chat')}>
                  Ver
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5 border-t border-line pt-4">
              <Link to="/reports" className="press flex items-center gap-2.5 rounded-2xl bg-mist/70 p-3 hover:bg-mist">
                <Radio className="h-[18px] w-[18px] text-teal-700" aria-hidden />
                <span className="text-[13.5px] font-bold text-ink">{state.myReports.length} reports</span>
              </Link>
              <Link to="/mercado?meus=1" className="press flex items-center gap-2.5 rounded-2xl bg-mist/70 p-3 hover:bg-mist">
                <ShoppingBag className="h-[18px] w-[18px] text-teal-700" aria-hidden />
                <span className="text-[13.5px] font-bold text-ink">{state.myListings.length} anúncios</span>
              </Link>
            </div>
          </Card>
        </section>

        <section>
          <SectionHeader title="Preferências" />
          <Card className="space-y-4 p-5">
            <div>
              <p className="mb-2 text-[14px] font-bold text-ink">Espécies favoritas</p>
              <div className="flex flex-wrap gap-2">
                {SPECIES.map((s) => (
                  <Chip key={s.id} active={profile.species.includes(s.id)} onClick={() => updateProfile({ species: toggle(profile.species, s.id) })}>
                    {s.name}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="border-t border-line pt-4">
              <p className="mb-2 text-[14px] font-bold text-ink">Modalidades</p>
              <div className="flex flex-wrap gap-2">
                {MODALITIES.map((m) => (
                  <Chip key={m.id} active={profile.modalities.includes(m.id)} onClick={() => updateProfile({ modalities: toggle(profile.modalities, m.id) })}>
                    {m.name}
                  </Chip>
                ))}
              </div>
            </div>
            <div className="border-t border-line pt-4">
              <Toggle checked={!state.prefs.installTipDismissed} onChange={(v) => setPref('installTipDismissed', !v)} label="Mostrar dica de instalação" description="No ecrã Início." />
            </div>
            <p className="border-t border-line pt-4 text-[12.5px] text-muted">Unidades: kg, cm, °C e km/h.</p>
          </Card>
        </section>

        <section>
          <SectionHeader title="Esta demonstração" />
          <Card className="space-y-4 p-5">
            <div className="flex gap-3">
              <Smartphone className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden />
              <div>
                <p className="mb-2 text-[14px] font-bold text-ink">Instalar no ecrã principal</p>
                <InstallSteps />
              </div>
            </div>
            <div className="flex gap-3 border-t border-line pt-4">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-teal-700" aria-hidden />
              <p className="text-[13px] leading-relaxed text-muted">
                {brand.name} é um protótipo. Não há conta, servidor nem partilha entre utilizadores: tudo o que regista fica neste navegador. Perfis, capturas de terceiros, provas, rankings e condições são fictícios. As fotografias das barragens vêm do Unsplash, com crédito ao autor; quando não mostram a própria barragem, isso é indicado junto da imagem.
              </p>
            </div>
            <div className="border-t border-line pt-4">
              <Button variant="outline" icon={RotateCcw} onClick={() => setConfirmReset(true)} className="w-full">
                Repor demonstração
              </Button>
            </div>
          </Card>
        </section>
      </div>

      <Sheet
        open={editing}
        onClose={() => setEditing(false)}
        title="Editar perfil"
        footer={
          <Button
            className="w-full"
            icon={Check}
            onClick={() => {
              updateProfile({ name: name.trim() || 'Pescador' })
              setEditing(false)
              toast('Perfil atualizado')
            }}
          >
            Guardar
          </Button>
        }
      >
        <label htmlFor="p-name" className="text-[13px] font-bold text-ink">Nome</label>
        <input id="p-name" className={cx(inputCls, 'mt-1.5')} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} />
        <p className="mb-2 mt-5 text-[13px] font-bold text-ink">Cor do avatar</p>
        <div className="flex gap-2.5">
          {AVATAR_COLORS.map((c) => (
            <button key={c} onClick={() => updateProfile({ avatarColor: c })} aria-label={`Cor ${c}`} aria-pressed={profile.avatarColor === c} className={cx('press h-10 w-10 rounded-full', profile.avatarColor === c && 'ring-[3px] ring-ink ring-offset-2')} style={{ background: c }} />
          ))}
        </div>
        <p className="mb-2 mt-5 text-[13px] font-bold text-ink">Região</p>
        <div className="flex flex-wrap gap-2">
          {REGIONS.map((r) => (
            <Chip key={r.id} active={profile.region === r.id} onClick={() => updateProfile({ region: r.id })}>
              {r.name}{r.country === 'ES' ? ' (ES)' : ''}
            </Chip>
          ))}
        </div>
      </Sheet>

      <ConfirmSheet
        open={confirmReset}
        onClose={() => setConfirmReset(false)}
        title="Repor demonstração?"
        text="Apaga as capturas, reports, anúncios, mensagens, fotografias, favoritos, jornadas, provas guardadas, subscrição e preferências deste navegador e volta ao estado inicial."
        confirmLabel="Repor"
        danger
        onConfirm={async () => {
          setConfirmReset(false)
          await resetDemo()
          toast('Demonstração reposta', { tone: 'info' })
          navigate('/boas-vindas', { replace: true })
        }}
      />
    </div>
  )
}
