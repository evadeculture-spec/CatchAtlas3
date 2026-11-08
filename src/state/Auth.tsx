import type { Session, User } from '@supabase/supabase-js'
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { clearSignedCache, getProfile, updateProfile } from '../lib/lanca/api'
import { backendConfigured, sb } from '../lib/lanca/supabase'
import type { Profile } from '../lib/lanca/types'
import { DEFAULT_UNITS, type Units } from '../lib/lanca/units'

/** Versão do aviso de privacidade aceite no registo (atualizar quando o texto mudar). */
export const PRIVACY_NOTICE_VERSION = '2026-11-08'

interface AuthState {
  configured: boolean
  loading: boolean
  session: Session | null
  user: User | null
  profile: Profile | null
  units: Units
  /** A sessão atual veio de um link de recuperação: o utilizador deve definir nova palavra-passe. */
  recovery: boolean
  clearRecovery: () => void
  refreshProfile: () => Promise<void>
  saveProfile: (patch: Partial<Profile>) => Promise<Profile>
  setProfile: (p: Profile) => void
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string, displayName: string) => Promise<{ needsConfirmation: boolean }>
  signOut: (everywhere?: boolean) => Promise<void>
  requestReset: (email: string) => Promise<void>
  updatePassword: (password: string) => Promise<void>
  resendConfirmation: (email: string) => Promise<void>
}

const Ctx = createContext<AuthState | null>(null)

const origin = () => window.location.origin

/** Mensagens de erro da autenticação em português (sem revelar se um email existe). */
export function authError(e: unknown): string {
  const m = (e as { message?: string })?.message ?? String(e)
  if (/Invalid login credentials/i.test(m)) return 'Email ou palavra-passe incorretos.'
  if (/Email not confirmed/i.test(m)) return 'Confirme primeiro o seu email (veja a caixa de entrada e o spam).'
  if (/User already registered/i.test(m)) return 'Já existe uma conta com este email. Inicie sessão ou recupere a palavra-passe.'
  if (/Password should be|weak/i.test(m)) return 'Palavra-passe demasiado fraca: use pelo menos 8 caracteres, com letras e números.'
  if (/rate limit|too many|over_email_send_rate_limit|security purposes/i.test(m)) return 'Demasiados pedidos. Aguarde alguns minutos e tente de novo.'
  if (/is invalid|invalid email|Unable to validate email/i.test(m)) return 'Endereço de email inválido.'
  if (/Failed to fetch|NetworkError|Load failed/i.test(m)) return 'Sem ligação ao servidor. Verifique a internet.'
  if (/same_password|different from the old/i.test(m)) return 'A nova palavra-passe tem de ser diferente da anterior.'
  if (/session|JWT|expired/i.test(m)) return 'O link expirou ou já foi usado. Peça um novo.'
  return m
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(backendConfigured)
  const [session, setSession] = useState<Session | null>(null)
  const [profileState, setProfileState] = useState<{ uid: string; profile: Profile } | null>(null)
  const [recovery, setRecovery] = useState(() => backendConfigured && /type=recovery/.test(window.location.hash))

  useEffect(() => {
    if (!backendConfigured) return
    let alive = true
    sb()
      .auth.getSession()
      .then(({ data }) => {
        if (!alive) return
        setSession(data.session)
        setLoading(false)
      })
      .catch(() => alive && setLoading(false))
    const { data: sub } = sb().auth.onAuthStateChange((event, s) => {
      setSession(s)
      if (event === 'PASSWORD_RECOVERY') setRecovery(true)
      if (event === 'SIGNED_OUT') {
        setProfileState(null)
        clearSignedCache()
      }
    })
    return () => {
      alive = false
      sub.subscription.unsubscribe()
    }
  }, [])

  const uid = session?.user.id
  const profile = profileState && profileState.uid === uid ? profileState.profile : null
  const setProfile = useCallback((p: Profile) => setProfileState({ uid: p.id, profile: p }), [])
  const refreshProfile = useCallback(async () => {
    if (!uid) return
    try {
      setProfile(await getProfile())
    } catch {
      /* o perfil é criado no registo; se falhar, os ecrãs mostram valores por omissão */
    }
  }, [uid, setProfile])
  useEffect(() => {
    if (!uid) return
    let alive = true
    // O perfil é criado no registo; se a leitura falhar, os ecrãs usam valores por omissão.
    getProfile().then((p) => alive && setProfile(p), () => undefined)
    return () => {
      alive = false
    }
  }, [uid, setProfile])

  const value = useMemo<AuthState>(
    () => ({
      configured: backendConfigured,
      loading,
      session,
      user: session?.user ?? null,
      profile,
      units: profile ? { unit_temperature: profile.unit_temperature, unit_length: profile.unit_length, unit_weight: profile.unit_weight, unit_wind: profile.unit_wind } : DEFAULT_UNITS,
      recovery,
      clearRecovery: () => setRecovery(false),
      refreshProfile,
      setProfile,
      saveProfile: async (patch) => {
        const p = await updateProfile(patch)
        setProfile(p)
        return p
      },
      signIn: async (email, password) => {
        const { error } = await sb().auth.signInWithPassword({ email: email.trim(), password })
        if (error) throw new Error(authError(error))
      },
      signUp: async (email, password, displayName) => {
        const { data, error } = await sb().auth.signUp({
          email: email.trim(),
          password,
          options: { emailRedirectTo: `${origin()}/entrar?confirmado=1`, data: { display_name: displayName.trim(), privacy_notice_version: PRIVACY_NOTICE_VERSION } },
        })
        if (error) throw new Error(authError(error))
        return { needsConfirmation: !data.session }
      },
      signOut: async (everywhere = false) => {
        await sb().auth.signOut({ scope: everywhere ? 'global' : 'local' })
        setSession(null)
      },
      requestReset: async (email) => {
        const { error } = await sb().auth.resetPasswordForEmail(email.trim(), { redirectTo: `${origin()}/nova-palavra-passe` })
        if (error) throw new Error(authError(error))
      },
      updatePassword: async (password) => {
        const { error } = await sb().auth.updateUser({ password })
        if (error) throw new Error(authError(error))
        setRecovery(false)
      },
      resendConfirmation: async (email) => {
        const { error } = await sb().auth.resend({ type: 'signup', email: email.trim(), options: { emailRedirectTo: `${origin()}/entrar?confirmado=1` } })
        if (error) throw new Error(authError(error))
      },
    }),
    [loading, session, profile, recovery, refreshProfile, setProfile],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthState {
  const v = useContext(Ctx)
  if (!v) throw new Error('useAuth fora do AuthProvider')
  return v
}

/** Validação da palavra-passe no cliente (o servidor aplica a sua própria política). */
export function passwordProblems(p: string): string | null {
  if (p.length < 8) return 'Use pelo menos 8 caracteres.'
  if (!/[A-Za-z]/.test(p) || !/\d/.test(p)) return 'Combine letras e números.'
  return null
}
