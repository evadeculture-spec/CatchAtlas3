import { KeyRound } from 'lucide-react'
import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { Button, Field, inputCls } from '../../components/ui'
import { Notice, Spinner } from '../../components/lanca/primitives'
import { useToast } from '../../state/Toasts'
import { passwordProblems, useAuth } from '../../state/Auth'
import { BackendMissing } from '../conta/Layout'
import { AuthLayout, FormError } from './AuthLayout'

export default function ResetPassword() {
  const { configured, loading, session, updatePassword } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  if (!configured) return <BackendMissing />
  const submit = async (e: FormEvent) => {
    e.preventDefault()
    const p = passwordProblems(password)
    if (p) return setErr(p)
    if (password !== confirm) return setErr('As palavras-passe não coincidem.')
    setBusy(true)
    setErr(null)
    try {
      await updatePassword(password)
      toast('Palavra-passe atualizada')
      nav('/conta', { replace: true })
    } catch (x) {
      setErr((x as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <AuthLayout title="Nova palavra-passe">
      {loading ? (
        <Spinner />
      ) : !session ? (
        <Notice tone="warn">
          O link de recuperação expirou ou já foi usado. <Link to="/recuperar" className="font-bold underline">Peça um novo</Link>.
        </Notice>
      ) : (
        <form onSubmit={submit} className="space-y-4" noValidate>
          <Field label="Nova palavra-passe" htmlFor="pw" hint="Pelo menos 8 caracteres, com letras e números.">
            <input id="pw" type="password" autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputCls} />
          </Field>
          <Field label="Repetir" htmlFor="pw2">
            <input id="pw2" type="password" autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} className={inputCls} />
          </Field>
          <FormError message={err} />
          <Button type="submit" size="lg" icon={KeyRound} className="w-full" disabled={busy || !password}>
            {busy ? 'A guardar…' : 'Guardar palavra-passe'}
          </Button>
        </form>
      )}
    </AuthLayout>
  )
}
