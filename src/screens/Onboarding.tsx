import { Check, Anchor, Footprints, Sailboat } from 'lucide-react'
import { useState } from 'react'
import { useNavigate } from 'react-router'
import { BrandLockup } from '../components/BrandMark'
import { Button, cx, inputCls } from '../components/ui'
import { brand } from '../config/brand'
import { MODALITIES, REGIONS, SPECIES } from '../data/catalog'
import type { ModalityId, RegionId, SpeciesId } from '../data/types'
import { useApp } from '../state/AppState'

const MOD_ICON = { margem: Footprints, caiaque: Sailboat, embarcacao: Anchor }

export default function Onboarding() {
  const { state, completeOnboarding } = useApp()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [species, setSpecies] = useState<SpeciesId[]>(state.profile.species)
  const [modalities, setModalities] = useState<ModalityId[]>(state.profile.modalities)
  const [region, setRegion] = useState<RegionId>(state.profile.region)
  const [name, setName] = useState(state.profile.name === 'Pescador' ? '' : state.profile.name)

  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])
  const finish = (skip = false) => {
    completeOnboarding(skip ? {} : { species: species.length ? species : ['achiga'], modalities: modalities.length ? modalities : ['margem'], region, name: name.trim() || 'Pescador' })
    navigate('/', { replace: true })
  }

  // Ecrã de boas-vindas. A demonstração não tem servidor nem autenticação:
  // "Entrar" abre a app com o perfil guardado neste navegador (antigo "Explorar demonstração");
  // "Criar conta" abre a criação do perfil local (antigo "Personalizar em 30 segundos").
  if (step === 0)
    return (
      <main className="welcome relative isolate flex min-h-dvh flex-col overflow-hidden bg-ink text-white">
        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute inset-0 opacity-[0.09]" style={{ backgroundImage: 'repeating-radial-gradient(circle at 50% 44%, #8fd9cd 0 1px, transparent 1px 22px)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 70% 55% at 50% 44%, rgb(36 73 91 / 0.55), transparent 70%)' }} />
          <div className="absolute inset-0" style={{ background: 'radial-gradient(ellipse 120% 90% at 50% 44%, transparent 55%, rgb(8 24 33 / 0.75))' }} />
        </div>

        <div className="pt-safe flex flex-1 flex-col items-center justify-center px-6 py-10 [@media(max-height:500px)]:py-6">
          <div className="flex w-full max-w-[360px] flex-col items-center text-center sm:max-w-[440px]">
            <h1 className="welcome-rise font-display text-[30px] font-medium leading-none tracking-[-0.01em] text-white/90 sm:text-[34px]" style={{ animationDelay: '40ms' }}>
              Bem-vindo
            </h1>
            <img
              src={brand.logo.srcLight}
              width={brand.logo.width}
              height={brand.logo.height}
              alt={brand.name}
              decoding="async"
              fetchPriority="high"
              className="welcome-rise mt-6 h-auto w-full max-w-[360px] sm:max-w-[440px] [@media(max-height:500px)]:max-w-[340px] drop-shadow-[0_10px_30px_rgb(0_0_0/0.25)] sm:mt-7"
              style={{ animationDelay: '120ms' }}
            />
            <div className="welcome-rise mt-12 flex w-full max-w-[300px] flex-col gap-3 sm:mt-14 sm:max-w-[320px] [@media(max-height:500px)]:mt-7" style={{ animationDelay: '220ms' }}>
              <button
                type="button"
                onClick={() => finish(true)}
                className="welcome-btn h-14 w-full rounded-2xl bg-teal text-[16px] font-extrabold text-ink shadow-[0_10px_24px_-10px_rgb(32_191_169/0.75)] hover:bg-[#2fcab4]"
              >
                Entrar
              </button>
              <button
                type="button"
                onClick={() => setStep(1)}
                className="welcome-btn h-14 w-full rounded-2xl border border-white/20 bg-white/[0.06] text-[16px] font-bold text-white backdrop-blur-sm hover:border-white/35 hover:bg-white/10"
              >
                Criar conta
              </button>
            </div>
          </div>
        </div>

        <p className="px-6 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-center text-[11.5px] leading-snug text-white/45">
          {brand.demoLabel}. Sem servidor: o perfil fica apenas neste navegador.
        </p>
      </main>
    )

  return (
    <div className="pt-safe mx-auto flex min-h-dvh w-full max-w-xl flex-col px-6 pb-8">
      <div className="flex items-center justify-between pt-5">
        <BrandLockup compact />
        <button onClick={() => finish(true)} className="press rounded-full px-3 py-2 text-[13px] font-bold text-muted hover:bg-ink/5">
          Saltar
        </button>
      </div>
      <div className="mt-6 flex gap-1.5" aria-label={`Passo ${step} de 3`}>
        {[1, 2, 3].map((i) => (
          <span key={i} className={cx('h-1.5 flex-1 rounded-full transition-colors', i <= step ? 'bg-teal' : 'bg-line')} />
        ))}
      </div>

      {step === 1 && (
        <section className="page-in mt-8">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-teal-700">Passo 1 de 3</p>
          <h1 className="font-display mt-2 text-[32px] font-semibold leading-tight text-ink">Que espécies procuras?</h1>
          <p className="mt-2 text-muted">Usamos isto para destacar rankings e sugestões. Podes escolher várias.</p>
          <div className="mt-6 grid grid-cols-2 gap-2.5">
            {SPECIES.map((s) => {
              const on = species.includes(s.id)
              return (
                <button
                  key={s.id}
                  onClick={() => setSpecies(toggle(species, s.id))}
                  aria-pressed={on}
                  className={cx('press flex h-16 items-center gap-3 rounded-2xl border-2 px-4 text-left', on ? 'border-ink bg-white' : 'border-transparent bg-white shadow-card')}
                >
                  <span className="h-3 w-3 rounded-full" style={{ background: s.color }} aria-hidden />
                  <span className="flex-1 font-extrabold text-ink">{s.name}</span>
                  {on && <Check className="h-5 w-5 text-teal-700" aria-hidden />}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="page-in mt-8">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-teal-700">Passo 2 de 3</p>
          <h1 className="font-display mt-2 text-[32px] font-semibold leading-tight text-ink">Como costumas pescar?</h1>
          <p className="mt-2 text-muted">Ajustamos o equipamento sugerido e as barragens em destaque.</p>
          <div className="mt-6 space-y-2.5">
            {MODALITIES.map((m) => {
              const on = modalities.includes(m.id)
              const I = MOD_ICON[m.id]
              return (
                <button
                  key={m.id}
                  onClick={() => setModalities(toggle(modalities, m.id))}
                  aria-pressed={on}
                  className={cx('press flex w-full items-center gap-4 rounded-2xl border-2 p-4 text-left', on ? 'border-ink bg-white' : 'border-transparent bg-white shadow-card')}
                >
                  <span className={cx('grid h-12 w-12 place-items-center rounded-xl', on ? 'bg-ink text-teal' : 'bg-mist text-ink')}>
                    <I className="h-6 w-6" aria-hidden />
                  </span>
                  <span className="flex-1">
                    <span className="block font-extrabold text-ink">{m.name}</span>
                    <span className="block text-[13px] text-muted">{m.hint}</span>
                  </span>
                  {on && <Check className="h-5 w-5 text-teal-700" aria-hidden />}
                </button>
              )
            })}
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="page-in mt-8">
          <p className="text-[12px] font-bold uppercase tracking-[0.14em] text-teal-700">Passo 3 de 3</p>
          <h1 className="font-display mt-2 text-[32px] font-semibold leading-tight text-ink">Onde pescas mais?</h1>
          <p className="mt-6 text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Portugal</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REGIONS.filter((r) => r.country === 'PT').map((r) => (
              <button
                key={r.id}
                onClick={() => setRegion(r.id)}
                aria-pressed={region === r.id}
                className={cx('press h-11 rounded-full border px-4 text-[14px] font-bold', region === r.id ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink')}
              >
                {r.name}
              </button>
            ))}
          </div>
          <p className="mt-5 text-[12px] font-bold uppercase tracking-[0.12em] text-muted">Espanha</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {REGIONS.filter((r) => r.country === 'ES').map((r) => (
              <button
                key={r.id}
                onClick={() => setRegion(r.id)}
                aria-pressed={region === r.id}
                className={cx('press h-11 rounded-full border px-4 text-[14px] font-bold', region === r.id ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink')}
              >
                {r.name}
              </button>
            ))}
          </div>
          <label htmlFor="ob-name" className="mt-8 block text-[13px] font-bold text-ink">
            Como te tratamos? <span className="font-semibold text-subtle">(opcional)</span>
          </label>
          <input id="ob-name" className={cx(inputCls, 'mt-1.5')} value={name} maxLength={24} onChange={(e) => setName(e.target.value)} placeholder="O teu nome" autoComplete="given-name" />
          <p className="mt-2 text-[12.5px] text-muted">Fica apenas neste navegador. Não há conta nem registo.</p>
        </section>
      )}

      <div className="mt-auto flex gap-3 pt-10">
        <Button variant="outline" size="lg" className="flex-1" onClick={() => setStep(step - 1)}>
          Voltar
        </Button>
        <Button size="lg" className="flex-[2]" onClick={() => (step < 3 ? setStep(step + 1) : finish())}>
          {step < 3 ? 'Continuar' : 'Começar a explorar'}
        </Button>
      </div>
    </div>
  )
}
