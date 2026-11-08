import { LogIn } from 'lucide-react'
import { useEffect, useState, type FormEvent } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router'
import { Button, Field, inputCls } from '../../components/ui'
import { Notice } from '../../components/lanca/primitives'
import { useAuth } from '../../state/Auth'
import { BackendMissing } from '../conta/Layout'
import { AuthLayout, FormError } from './AuthLayout'

const safeNext = (n: string | null) => (n && n.startsWith('/') && !n.startsWith('//') ? n : '/conta')

export default function SignIn() {
  const { configured, session, signIn, resendConfirmation } = useAuth()
  const [params] = useSearchParams()
  const nav = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [info, setInfo] = useState<string | null>(null)
  const next = safeNext(params.get('next'))
  useEffect(() => {
    if (session) nav(next, { replace: true })
  }, [session, next, nav])
  if (!configured) return <BackendMissing />
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await signIn(email, password)
    } catch (x) {
      setErr((x as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const unconfirmed = err?.startsWith('Confirme')
  return (
    <AuthLayout
      title="Entrar"
      subtitle="Aceda aos seus Pins, Pings e jornadas. Os seus dados são privados."
      footer={
        <>
          Ainda não tem conta?{' '}
          <Link to={`/registar${params.get('next') ? `?next=${encodeURIComponent(next)}` : ''}`} className="font-bold text-teal underline-offset-2 hover:underline">
            Criar conta
          </Link>
        </>
      }
    >
      {params.get('confirmado') && !session && <Notice className="mb-4">Email confirmado. Inicie sessão para continuar.</Notice>}
      <form onSubmit={submit} className="space-y-4" noValidate>
        <Field label="Email" htmlFor="email">
          <input id="email" type="email" autoComplete="email" inputMode="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
        </Field>
        <Field label="Palavra-passe" htmlFor="password">
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
        </Field>
        <FormError message={err} />
        {unconfirmed && (
          <button
            type="button"
            className="text-[13px] font-bold text-teal-700 underline-offset-2 hover:underline"
            onClick={async () => {
              try {
                await resendConfirmation(email)
                setInfo('Enviámos um novo email de confirmação.')
              } catch (x) {
                setErr((x as Error).message)
              }
            }}
          >
            Reenviar email de confirmação
          </button>
        )}
        {info && <Notice>{info}</Notice>}
        <Button type="submit" size="lg" icon={LogIn} className="w-full" disabled={busy || !email || !password}>
          {busy ? 'A entrar…' : 'Entrar'}
        </Button>
        <p className="text-center">
          <Link to="/recuperar" className="text-[13.5px] font-bold text-teal-700 underline-offset-2 hover:underline">
            Esqueci-me da palavra-passe
          </Link>
        </p>
      </form>
    </AuthLayout>
  )
}
