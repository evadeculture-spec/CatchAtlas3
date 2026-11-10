import { FlaskConical } from 'lucide-react'
import { useState } from 'react'
import { Link } from 'react-router'
import { cx } from '../ui'
import { useAuth } from '../../state/Auth'

/**
 * «Experimentar sem email»: abre uma sessão de teste (início de sessão anónimo do Supabase).
 * Os dados são reais e privados (mesmas regras de acesso de uma conta normal), mas ficam ligados só a este navegador:
 * sem email nem palavra-passe não há forma de voltar a entrar, por isso terminar a sessão apaga-os (ver Definições).
 */
export function GuestEntry({ tone = 'light', onSignedIn, className }: { tone?: 'light' | 'dark'; onSignedIn?: () => void; className?: string }) {
  const { configured, signInGuest } = useAuth()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  if (!configured) return null
  const dark = tone === 'dark'
  return (
    <div className={cx('text-left', className)} data-guest-entry>
      <button
        type="button"
        disabled={busy}
        onClick={async () => {
          setBusy(true)
          setErr(null)
          try {
            await signInGuest()
            onSignedIn?.()
          } catch (x) {
            setErr((x as Error).message)
          } finally {
            setBusy(false)
          }
        }}
        className={cx(
          'press inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border px-4 text-[14px] font-bold disabled:opacity-60',
          dark ? 'border-white/20 text-white hover:bg-white/10' : 'border-line bg-white text-ink hover:bg-mist',
        )}
        data-action="sessao-teste"
      >
        <FlaskConical className="h-4 w-4" aria-hidden /> {busy ? 'A abrir sessão de teste…' : 'Experimentar sem email'}
      </button>
      <p className={cx('mt-2 text-[12px] leading-snug', dark ? 'text-[#b5c5cc]' : 'text-muted')}>
        Sessão de teste: sem email nem palavra-passe. Os pins e fotografias são reais e privados, mas ficam ligados só a este navegador e são apagados quando terminar a sessão. Ao continuar, aceita o{' '}
        <Link to="/privacidade" target="_blank" className={cx('font-bold underline', dark ? 'text-[#83e5ef]' : 'text-teal-700')}>
          aviso de privacidade
        </Link>
        .
      </p>
      {err && (
        <p role="alert" className={cx('mt-2 rounded-xl px-3 py-2 text-[12.5px] font-semibold', dark ? 'bg-amber-50 text-amber-900' : 'bg-amber-50 text-amber-900')}>
          {err}
        </p>
      )}
    </div>
  )
}
