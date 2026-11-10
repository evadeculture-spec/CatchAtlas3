import { MailCheck, UserPlus } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, Navigate } from 'react-router'
import { Button, Field, inputCls } from '../../components/ui'
import { passwordProblems, useAuth } from '../../state/Auth'
import { BackendMissing } from '../conta/Layout'
import { GuestEntry } from '../../components/lanca/GuestEntry'
import { AuthLayout, FormError } from './AuthLayout'

export default function SignUp() {
  const { configured, session, signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [accept, setAccept] = useState(false)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [sent, setSent] = useState(false)
  if (!configured) return <BackendMissing />
  if (session) return <Navigate to="/conta" replace />
  const pwErr = password ? passwordProblems(password) : null
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    if (!accept) return setErr('Para criar conta, leia e aceite o aviso de privacidade.')
    if (passwordProblems(password)) return setErr(passwordProblems(password))
    setBusy(true)
    setErr(null)
    try {
      const r = await signUp(email, password, name)
      if (r.needsConfirmation) setSent(true)
    } catch (x) {
      setErr((x as Error).message)
    } finally {
      setBusy(false)
    }
  }
  if (sent)
    return (
      <AuthLayout title="Confirme o seu email" footer={<Link to="/entrar" className="font-bold text-teal">Voltar a Entrar</Link>}>
        <div className="flex items-start gap-3">
          <MailCheck className="mt-0.5 h-6 w-6 shrink-0 text-teal-700" aria-hidden />
          <p className="text-[14.5px] leading-relaxed text-muted">
            Enviámos um link de confirmação para <strong className="text-ink">{email}</strong>. Abra-o para ativar a conta (veja também o spam). Depois, inicie sessão.
          </p>
        </div>
      </AuthLayout>
    )
  return (
    <AuthLayout
      title="Criar conta"
      subtitle="Uma conta privada para guardar os seus locais, experiências e jornadas."
      footer={
        <>
          Já tem conta?{' '}
          <Link to="/entrar" className="font-bold text-teal underline-offset-2 hover:underline">
            Entrar
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Nome ou alcunha" htmlFor="name" optional>
          <input id="name" autoComplete="nickname" maxLength={60} value={name} onChange={(e) => setName(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Palavra-passe" htmlFor="password" hint="Pelo menos 8 caracteres, com letras e números." error={pwErr ?? undefined}>
          <input id="password" type="password" autoComplete="new-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </Field>
        <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-mist p-3.5 text-[13px] leading-relaxed text-muted">
          <input type="checkbox" checked={accept} onChange={(e) => setAccept(e.target.checked)} className="mt-0.5 h-5 w-5 shrink-0 accent-[#20bfa9]" />
          <span>
            Li o{' '}
            <Link to="/privacidade" target="_blank" className="font-bold text-teal-700 underline">
              aviso de privacidade
            </Link>
            . Percebo que a conta guarda localizações, fotografias e notas de pesca, privadas por defeito, e que posso exportá-las ou apagar a conta a qualquer momento.
          </span>
        </label>
        <FormError message={err} />
        <Button type="submit" size="lg" icon={UserPlus} className="w-full" disabled={busy || !email || !password}>
          {busy ? 'A criar…' : 'Criar conta'}
        </Button>
      </form>
      <div className="mt-5 border-t border-line pt-5">
        <GuestEntry />
      </div>
    </AuthLayout>
  )
}
