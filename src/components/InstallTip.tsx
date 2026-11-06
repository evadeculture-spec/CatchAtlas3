import { Smartphone, X } from 'lucide-react'
import { useApp } from '../state/AppState'
import { brand } from '../config/brand'

export const isStandalone = () => {
  try {
    return window.matchMedia('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone === true
  } catch {
    return false
  }
}

export function InstallSteps() {
  return (
    <ol className="space-y-2 text-[13.5px] leading-snug text-muted">
      <li>
        <b className="text-ink">iPhone (Safari):</b> toque em Partilhar e depois em “Adicionar ao ecrã principal”.
      </li>
      <li>
        <b className="text-ink">Android (Chrome):</b> abra o menu ⋮ e escolha “Instalar app” ou “Adicionar ao ecrã principal”.
      </li>
      <li>
        <b className="text-ink">Computador (Chrome/Edge):</b> use o ícone de instalação na barra de endereço.
      </li>
    </ol>
  )
}

export function InstallTip() {
  const { state, setPref } = useApp()
  if (state.prefs.installTipDismissed || isStandalone()) return null
  return (
    <div className="relative rounded-[var(--radius-card)] border border-line bg-white p-4 pr-12">
      <div className="flex gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-teal-50 text-teal-700">
          <Smartphone className="h-5 w-5" aria-hidden />
        </span>
        <div>
          <p className="font-extrabold text-ink">Instale o {brand.name} no ecrã principal</p>
          <p className="mb-3 mt-0.5 text-[13px] text-muted">Abre em ecrã inteiro, como uma aplicação.</p>
          <InstallSteps />
        </div>
      </div>
      <button
        onClick={() => setPref('installTipDismissed', true)}
        className="press absolute right-2 top-2 grid h-10 w-10 place-items-center rounded-full text-muted hover:bg-ink/5"
        aria-label="Fechar dica de instalação"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  )
}
