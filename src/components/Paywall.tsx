import { Check, Crown, Gift, MessageCircle, Radio } from 'lucide-react'
import { brand } from '../config/brand'
import { useApp } from '../state/AppState'
import { useToast } from '../state/Toasts'
import { Button } from './ui'

const BENEFITS = [
  { icon: MessageCircle, text: 'Chat global com pescadores de Portugal e Espanha' },
  { icon: Radio, text: 'Reports em destaque no mapa de pings' },
  { icon: Gift, text: 'Participação extra no giveaway' },
]

/** Ecrã de subscrição simulada: não há pagamentos na demonstração. */
export function Paywall({ title = 'Chat de subscritores' }: { title?: string }) {
  const { setSubscription } = useApp()
  const toast = useToast()
  return (
    <div className="overflow-hidden rounded-[28px] bg-ink text-white shadow-lift">
      <div className="p-6 sm:p-8">
        <span className="inline-flex items-center gap-1.5 rounded-full bg-amber px-2.5 py-1 text-[11.5px] font-extrabold text-ink">
          <Crown className="h-3.5 w-3.5" aria-hidden /> {brand.subscription.name}
        </span>
        <h2 className="font-display mt-4 text-[30px] font-semibold leading-tight">{title}</h2>
        <p className="mt-2 max-w-md text-[14.5px] leading-relaxed text-white/70">Disponível para subscritores. Na demonstração pode ativar a subscrição sem qualquer pagamento.</p>
        <ul className="mt-5 space-y-3">
          {BENEFITS.map((b) => (
            <li key={b.text} className="flex items-center gap-3 text-[14px] font-semibold">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/10 text-teal">
                <b.icon className="h-[18px] w-[18px]" aria-hidden />
              </span>
              {b.text}
            </li>
          ))}
        </ul>
        <p className="tnum mt-6 text-[13px] text-white/60">{brand.subscription.priceLabel}</p>
        <Button
          size="lg"
          icon={Check}
          className="mt-3 w-full sm:w-auto"
          onClick={() => {
            setSubscription(true)
            toast('Subscrição de demonstração ativa', { detail: 'Sem pagamento. Pode cancelar no Perfil.' })
          }}
        >
          Ativar sem pagamento
        </Button>
        <p className="mt-3 text-[12px] text-white/50">Simulação: não é pedido nenhum dado de pagamento.</p>
      </div>
    </div>
  )
}
