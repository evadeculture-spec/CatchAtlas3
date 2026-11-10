import { Download, FileArchive, KeyRound, LogOut, Plus, Trash2, Upload } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { Sheet } from '../../components/Dialog'
import { Button, Chip, Field, inputCls, Segmented } from '../../components/ui'
import { ErrorBox, KV, Notice, Panel, selectCls, useLoad } from '../../components/lanca/primitives'
import { SignedImage } from '../../components/lanca/SignedImage'
import { TagInput } from '../../components/lanca/TagInput'
import { createEquipment, deleteAccount, deleteEquipment, downloadOriginal, exportAll, friendly, listEquipment, uploadAvatar } from '../../lib/lanca/api'
import { EQUIPMENT_KINDS, MODALITIES, SPECIES_SUGGESTIONS, TECHNIQUE_SUGGESTIONS } from '../../lib/lanca/labels'
import { AVATAR_BUCKET } from '../../lib/lanca/supabase'
import type { EquipmentKind, Profile } from '../../lib/lanca/types'
import { passwordProblems, useAuth } from '../../state/Auth'
import { useToast } from '../../state/Toasts'

function saveBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 2000)
}

export default function Settings() {
  const { user, profile } = useAuth()
  if (!profile || !user) return <Notice>A carregar o perfil…</Notice>
  return <SettingsBody key={profile.id} profile={profile} />
}

function SettingsBody({ profile }: { profile: Profile }) {
  const { user, isGuest, saveProfile, setProfile, signOut, updatePassword } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [draft, setDraft] = useState<Partial<Profile>>(profile)
  const [saving, setSaving] = useState(false)
  const [pw, setPw] = useState('')
  const [geo, setGeo] = useState<string>('desconhecido')
  const [exporting, setExporting] = useState<string | null>(null)
  const [delOpen, setDelOpen] = useState(false)
  const [delText, setDelText] = useState('')
  const [deleting, setDeleting] = useState(false)
  const avatarRef = useRef<HTMLInputElement>(null)
  const eq = useLoad(listEquipment, [])
  const [eqName, setEqName] = useState('')
  const [eqKind, setEqKind] = useState<EquipmentKind>('cana')

  useEffect(() => {
    navigator.permissions
      ?.query({ name: 'geolocation' as PermissionName })
      .then((s) => {
        setGeo(s.state)
        s.onchange = () => setGeo(s.state)
      })
      .catch(() => setGeo('desconhecido'))
  }, [])

  if (!user) return null
  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setDraft((d) => ({ ...d, [k]: v }))
  const save = async (patch: Partial<Profile>, msg = 'Preferências guardadas') => {
    setSaving(true)
    try {
      await saveProfile(patch)
      toast(msg)
    } catch (e) {
      toast(friendly(e), { tone: 'warning' })
    } finally {
      setSaving(false)
    }
  }

  const exportJson = async () => {
    setExporting('json')
    try {
      const data = await exportAll()
      saveBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `lanca-lance-dados-${new Date().toISOString().slice(0, 10)}.json`)
      toast('Exportação concluída')
    } catch (e) {
      toast(friendly(e), { tone: 'warning' })
    } finally {
      setExporting(null)
    }
  }
  const exportZip = async () => {
    setExporting('zip')
    try {
      const { zipSync, strToU8 } = await import('fflate')
      const data = await exportAll()
      const files: Record<string, Uint8Array | [Uint8Array, { level: 0 }]> = { 'dados.json': strToU8(JSON.stringify(data, null, 2)) }
      const photos = (data.photos ?? []) as { storage_path: string; ping_id: string }[]
      for (const [i, p] of photos.entries()) {
        setExporting(`zip:${i + 1}/${photos.length}`)
        const blob = await downloadOriginal(p.storage_path)
        files[`fotografias/${p.ping_id}/${p.storage_path.split('/').pop()}`] = [new Uint8Array(await blob.arrayBuffer()), { level: 0 }]
      }
      saveBlob(new Blob([zipSync(files) as BlobPart], { type: 'application/zip' }), `lanca-lance-${new Date().toISOString().slice(0, 10)}.zip`)
      toast('Exportação com fotografias concluída')
    } catch (e) {
      toast(friendly(e), { tone: 'warning' })
    } finally {
      setExporting(null)
    }
  }
  const doDelete = async () => {
    setDeleting(true)
    try {
      await deleteAccount()
      toast(isGuest ? 'Sessão de teste terminada' : 'Conta eliminada', { detail: 'Todos os seus dados e fotografias foram apagados.' })
      nav('/', { replace: true })
    } catch (e) {
      toast(friendly(e), { tone: 'warning' })
      setDeleting(false)
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-[24px] font-extrabold text-ink">Definições</h1>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Panel title="Identidade">
          <div className="mb-4 flex items-center gap-4">
            {profile.avatar_path ? <SignedImage path={profile.avatar_path} bucket={AVATAR_BUCKET} alt="Fotografia de perfil" className="h-16 w-16 rounded-full" /> : <span className="grid h-16 w-16 place-items-center rounded-full bg-mist text-[22px] font-extrabold text-muted">{(profile.display_name || user.email || '?')[0].toUpperCase()}</span>}
            <input
              ref={avatarRef}
              type="file"
              accept="image/*"
              className="sr-only"
              tabIndex={-1}
              aria-hidden
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) return
                try {
                  setProfile(await uploadAvatar(f, profile.avatar_path))
                  toast('Fotografia de perfil atualizada')
                } catch (x) {
                  toast(friendly(x), { tone: 'warning' })
                }
              }}
            />
            <Button size="sm" variant="outline" icon={Upload} onClick={() => avatarRef.current?.click()}>
              Mudar fotografia
            </Button>
          </div>
          <div className="space-y-3">
            <Field label="Nome ou alcunha" htmlFor="dn">
              <input id="dn" maxLength={60} value={draft.display_name ?? ''} onChange={(e) => set('display_name', e.target.value)} className={inputCls} />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="País" htmlFor="ct">
                <select id="ct" value={draft.country ?? ''} onChange={(e) => set('country', e.target.value || null)} className={selectCls}>
                  <option value="">—</option>
                  <option value="PT">Portugal</option>
                  <option value="ES">Espanha</option>
                  <option value="FR">França</option>
                  <option value="GB">Reino Unido</option>
                  <option value="BR">Brasil</option>
                </select>
              </Field>
              <Field label="Idioma" htmlFor="lg" hint="A interface está, para já, em português.">
                <select id="lg" value={draft.language ?? 'pt-PT'} onChange={(e) => set('language', e.target.value as Profile['language'])} className={selectCls}>
                  <option value="pt-PT">Português</option>
                  <option value="es-ES">Español</option>
                  <option value="en">English</option>
                </select>
              </Field>
            </div>
            <dl>
              <KV label="Email" value={isGuest ? 'Sessão de teste (sem email)' : user.email} />
              <KV label="Membro desde" value={new Date(profile.created_at).toLocaleDateString('pt-PT', { dateStyle: 'long' })} />
            </dl>
            <Button disabled={saving} onClick={() => save({ display_name: draft.display_name?.trim() || null, country: draft.country ?? null, language: draft.language })}>
              Guardar
            </Button>
          </div>
        </Panel>

        <Panel title="Perfil de pesca">
          <div className="space-y-3">
            <div>
              <p className="mb-1.5 text-[13px] font-bold text-ink">Modalidades preferidas</p>
              <div className="flex flex-wrap gap-2">
                {MODALITIES.map((m) => {
                  const on = draft.modalities?.includes(m.id)
                  return (
                    <Chip key={m.id} active={on} onClick={() => set('modalities', on ? draft.modalities!.filter((x) => x !== m.id) : [...(draft.modalities ?? []), m.id])}>
                      {m.label}
                    </Chip>
                  )
                })}
              </div>
            </div>
            <Field label="Espécies favoritas">
              <TagInput value={draft.favorite_species ?? []} onChange={(v) => set('favorite_species', v)} suggestions={SPECIES_SUGGESTIONS} placeholder="Adicionar espécie" />
            </Field>
            <Field label="Técnicas preferidas">
              <TagInput value={draft.techniques ?? []} onChange={(v) => set('techniques', v)} suggestions={TECHNIQUE_SUGGESTIONS} placeholder="Adicionar técnica" />
            </Field>
            <Field label="Áreas habituais" htmlFor="ha" optional hint="Texto livre (ex.: Médio Tejo, Alqueva). Não guarda coordenadas.">
              <input id="ha" maxLength={200} value={draft.home_areas ?? ''} onChange={(e) => set('home_areas', e.target.value)} className={inputCls} />
            </Field>
            <Button disabled={saving} onClick={() => save({ modalities: draft.modalities, favorite_species: draft.favorite_species, techniques: draft.techniques, home_areas: draft.home_areas?.trim() || null })}>
              Guardar
            </Button>
          </div>
        </Panel>

        <Panel title="Unidades">
          <div className="space-y-3">
            {(
              [
                ['Temperatura', 'unit_temperature', [{ id: 'c', label: '°C' }, { id: 'f', label: '°F' }]],
                ['Comprimento', 'unit_length', [{ id: 'cm', label: 'cm' }, { id: 'in', label: 'polegadas' }]],
                ['Peso', 'unit_weight', [{ id: 'kg', label: 'kg' }, { id: 'lb', label: 'lb' }]],
                ['Vento', 'unit_wind', [{ id: 'kmh', label: 'km/h' }, { id: 'ms', label: 'm/s' }, { id: 'kn', label: 'nós' }]],
              ] as const
            ).map(([label, key, opts]) => (
              <div key={key} className="flex items-center justify-between gap-3">
                <span className="text-[14px] font-bold text-ink">{label}</span>
                <Segmented label={label} value={(profile[key] as string) ?? opts[0].id} options={opts as unknown as { id: string; label: string }[]} onChange={(v) => save({ [key]: v } as Partial<Profile>, 'Unidades atualizadas')} />
              </div>
            ))}
            <p className="text-[11.5px] text-subtle">Os valores são guardados em unidades métricas e convertidos só na apresentação.</p>
          </div>
        </Panel>

        <Panel title="Equipamento">
          {eq.error ? (
            <ErrorBox message={eq.error} onRetry={eq.reload} />
          ) : (
            <>
              <ul className="mb-3 space-y-1">
                {(eq.data ?? []).map((e) => (
                  <li key={e.id} className="flex items-center gap-2 rounded-xl px-2 py-1.5 hover:bg-mist">
                    <span className="min-w-0 flex-1 truncate text-[14px] font-bold text-ink">{e.name}</span>
                    <span className="text-[12px] text-muted">{EQUIPMENT_KINDS.find((k) => k.id === e.kind)?.label}</span>
                    <button
                      type="button"
                      className="grid h-8 w-8 place-items-center rounded-full text-subtle hover:text-danger"
                      aria-label={`Apagar ${e.name}`}
                      onClick={async () => {
                        try {
                          await deleteEquipment(e.id)
                          eq.setData((eq.data ?? []).filter((x) => x.id !== e.id))
                        } catch (x) {
                          toast(friendly(x), { tone: 'warning' })
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4" aria-hidden />
                    </button>
                  </li>
                ))}
                {eq.data?.length === 0 && <li className="text-[13px] text-muted">Sem equipamento registado. Pode adicioná-lo às listas das jornadas.</li>}
              </ul>
              <form
                className="flex gap-2"
                onSubmit={async (e) => {
                  e.preventDefault()
                  if (!eqName.trim()) return
                  try {
                    const row = await createEquipment({ name: eqName.trim().slice(0, 80), kind: eqKind })
                    eq.setData([...(eq.data ?? []), row])
                    setEqName('')
                  } catch (x) {
                    toast(friendly(x), { tone: 'warning' })
                  }
                }}
              >
                <input value={eqName} onChange={(e) => setEqName(e.target.value)} placeholder="Ex.: Cana 2,10 m 7–28 g" className={inputCls} aria-label="Nome do equipamento" />
                <select value={eqKind} onChange={(e) => setEqKind(e.target.value as EquipmentKind)} className={`${selectCls} w-36`} aria-label="Tipo">
                  {EQUIPMENT_KINDS.map((k) => (
                    <option key={k.id} value={k.id}>
                      {k.label}
                    </option>
                  ))}
                </select>
                <Button type="submit" variant="dark" icon={Plus} aria-label="Adicionar equipamento" />
              </form>
            </>
          )}
        </Panel>

        <Panel title="Privacidade e autorizações">
          <dl>
            <KV label="Visibilidade do perfil" value="Privado (só você)" />
            <KV label="Pins e Pings" value="Privados (só você)" />
            <KV label="Aviso de privacidade aceite" value={profile.privacy_notice_version ? `versão ${profile.privacy_notice_version}${profile.privacy_notice_accepted_at ? ` · ${new Date(profile.privacy_notice_accepted_at).toLocaleDateString('pt-PT')}` : ''}` : null} />
            <KV label="Localização neste navegador" value={{ granted: 'Autorizada', denied: 'Recusada', prompt: 'Pergunta quando necessário', desconhecido: 'Desconhecido' }[geo] ?? geo} />
          </dl>
          <p className="mt-3 text-[12.5px] leading-relaxed text-muted">
            A localização só é pedida quando carrega em “Posição atual”. Para revogar a autorização, use as definições do site no navegador. Os seus dados não são partilhados com outros utilizadores, não são usados para treinar modelos nem para estatísticas públicas.{' '}
            <Link to="/privacidade" className="font-bold text-teal-700 underline">
              Aviso de privacidade
            </Link>
          </p>
        </Panel>

        <Panel title="Segurança">
          {isGuest ? (
            <div className="space-y-3" data-guest-session>
              <p className="text-[13px] text-muted">
                Está numa sessão de teste, sem email nem palavra-passe. Depois de sair não há forma de voltar a entrar nela, por isso terminar a sessão apaga os pins, fotografias e jornadas desta sessão. Exporte antes se quiser guardar uma cópia.
              </p>
              <Button variant="outline" icon={LogOut} onClick={() => setDelOpen(true)}>
                Terminar sessão de teste
              </Button>
            </div>
          ) : (
            <>
          <form
            className="space-y-3"
            onSubmit={async (e) => {
              e.preventDefault()
              const p = passwordProblems(pw)
              if (p) return toast(p, { tone: 'warning' })
              try {
                await updatePassword(pw)
                setPw('')
                toast('Palavra-passe alterada')
              } catch (x) {
                toast((x as Error).message, { tone: 'warning' })
              }
            }}
          >
            <Field label="Nova palavra-passe" htmlFor="npw" hint="Pelo menos 8 caracteres, com letras e números.">
              <input id="npw" type="password" autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} className={inputCls} />
            </Field>
            <Button type="submit" variant="outline" icon={KeyRound} disabled={!pw}>
              Alterar palavra-passe
            </Button>
          </form>
          <div className="mt-4 flex flex-wrap gap-2 border-t border-line pt-4">
            <Button variant="outline" icon={LogOut} onClick={() => signOut().then(() => nav('/'))}>
              Terminar sessão
            </Button>
            <Button variant="ghost" onClick={() => signOut(true).then(() => nav('/'))}>
              Terminar em todos os dispositivos
            </Button>
          </div>
            </>
          )}
        </Panel>

        <Panel title="Os seus dados" className="lg:col-span-2">
          <p className="mb-3 text-[13px] text-muted">Direito de acesso e portabilidade (RGPD): descarregue tudo o que está na sua conta. Cada exportação fica registada no histórico de auditoria da conta.</p>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" icon={Download} disabled={!!exporting} onClick={exportJson}>
              {exporting === 'json' ? 'A preparar…' : 'Exportar dados (JSON)'}
            </Button>
            <Button variant="outline" icon={FileArchive} disabled={!!exporting} onClick={exportZip}>
              {exporting?.startsWith('zip') ? `A preparar ${exporting.slice(4) || ''}…` : 'Exportar com fotografias (ZIP)'}
            </Button>
          </div>
          <div className="mt-5 rounded-2xl border border-danger/25 p-4">
            <p className="text-[14px] font-extrabold text-danger">Eliminar conta</p>
            <p className="mt-1 text-[13px] text-muted">Apaga definitivamente a conta, os Pins, Pings, fotografias, capturas, jornadas e equipamento. Não é possível recuperar. Exporte antes se quiser guardar uma cópia.</p>
            <Button variant="danger" size="sm" icon={Trash2} className="mt-3" onClick={() => setDelOpen(true)}>
              Eliminar conta
            </Button>
          </div>
        </Panel>
      </div>

      <Sheet
        open={delOpen}
        onClose={() => setDelOpen(false)}
        title={isGuest ? 'Terminar a sessão de teste?' : 'Eliminar a conta definitivamente?'}
        footer={
          <Button variant="danger" className="w-full" disabled={(!isGuest && delText !== 'ELIMINAR') || deleting} onClick={doDelete}>
            {deleting ? 'A eliminar…' : isGuest ? 'Apagar dados e sair' : 'Eliminar tudo'}
          </Button>
        }
      >
        {isGuest ? (
          <p className="text-[14px] leading-relaxed text-muted">
            Os pins, fotografias, partilhas e jornadas desta sessão de teste são apagados de imediato, no servidor e neste dispositivo. Sem email nem palavra-passe, não é possível voltar a esta sessão.
          </p>
        ) : (
          <>
            <p className="text-[14px] leading-relaxed text-muted">
              Para confirmar, escreva <strong className="text-ink">ELIMINAR</strong>. Todos os dados e fotografias desta conta ({user.email}) são apagados de imediato.
            </p>
            <input value={delText} onChange={(e) => setDelText(e.target.value)} className={`${inputCls} mt-3`} aria-label="Escreva ELIMINAR para confirmar" autoComplete="off" />
          </>
        )}
      </Sheet>
    </div>
  )
}
