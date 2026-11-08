import { Mail } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Button, Field, inputCls } from '../../components/ui'
import { Notice } from '../../components/lanca/primitives'
import { useAuth } from '../../state/Auth'
import { BackendMissing } from '../conta/Layout'
import { AuthLayout, FormError } from './AuthLayout'

export default function ForgotPassword() {
  const { configured, requestReset } = useAuth()
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  if (!configured) return <BackendMissing />
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr(null)
    try {
      await requestReset(email)
      setDone(true)
    } catch (x) {
      setErr((x as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthLayout title="Recuperar palavra-passe" subtitle="Enviamos um link para definir uma nova palavra-passe." footer={<Link to="/entrar" className="font-bold text-teal">Voltar a Entrar</Link>}>
      {done ? (
        // Mesma mensagem exista ou não a conta (não revela que emails estão registados).
        <Notice>Se existir uma conta com {email}, vai receber um email com o link de recuperação nos próximos minutos.</Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Email" htmlFor="email">
            <input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} className={inputCls} />
          </Field>
          <FormError message={err} />
          <Button type="submit" size="lg" icon={Mail} className="w-full" disabled={busy || !email}>
            {busy ? 'A enviar…' : 'Enviar link'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
