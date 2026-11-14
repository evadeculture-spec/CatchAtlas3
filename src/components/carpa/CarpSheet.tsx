/**
 * Ficha «Carpa» (mobile e painel lateral), lista com filtros e resultados na pesquisa do Atlas.
 * Mostra separadamente presença, regime para a data/modalidade e acesso; estados com texto e símbolo além da cor;
 * fonte no idioma original, verificação e proveniência (folha/linha). Nada é inventado: sem coordenadas, diz-se.
 */
import { CalendarPlus, Crosshair, ExternalLink, Loader2, MapPinPlus, Navigation, X } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router'
import { classify, T, type Activity, type Lang, type PermissionState, type Tri } from '../../lib/carpa/model'
import { conditions, type ConditionsResponse } from '../../lib/lanca/api'
import { cx } from '../ui'
import { anchorOf, searchCarp, stateOf, STATE_COLOR, STATE_GLYPH, type CarpFilter, type CarpIndex } from './data'

const ACTIVITIES: Activity[] = ['pesca-individual', 'carpfishing', 'carpfishing-noturno', 'provas']
const triText = (v: Tri, lang: Lang) => (v === 'sim' ? (lang === 'es' ? 'Sí' : 'Sim') : v === 'nao' ? (lang === 'es' ? 'No' : 'Não') : lang === 'es' ? 'No documentado' : 'Não documentado')
const L = {
  pt: { local: 'Local do Atlas da Carpa · não é um pin pessoal', data: 'Data da jornada', modalidade: 'Modalidade', condicoes: 'Condições documentadas', licenca: 'Licença', epoca: 'Época', noturna: 'Pesca noturna', devolucao: 'Devolução obrigatória', gestor: 'Gestor', horario: 'Horário', presenca: 'Presença', acesso: 'Acesso à margem', localizacao: 'Localização', fontes: 'Fontes', verificado: 'Verificado em', semVerif: 'Sem verificação independente registada', importado: 'Importado em', naoVerif: '(importação, não é verificação)', linha: 'Origem', marcar: 'Marcar pin aqui', jornada: 'Preparar jornada', enquadrar: 'Enquadrar', fechar: 'Fechar ficha', porque: 'Porquê', planear: 'Pode planear a jornada; confirme as condições no local.', confirmar: 'Antes de planear, falta confirmar:', proibido: 'A fonte competente proíbe esta pesca nesta data.', previsao: 'Previsão meteorológica', previsto: 'Previsto (modelo), não observado', semPrev: 'Sem previsão para esta data.', navegar: 'Navegar até ao ponto documentado', idioma: 'Idioma da ficha', original: 'documento em', documentado: 'O que está documentado', base: 'Base documental', regras: 'Acesso e condições', regDevolucao: 'Devolução da carpa', vigencia: 'Vigência', semDatas: 'sem datas na fonte', textoFonte: 'texto da fonte, não traduzido' },
  es: { local: 'Lugar del Atlas de la Carpa · no es un pin personal', data: 'Fecha de la jornada', modalidade: 'Modalidad', condicoes: 'Condiciones documentadas', licenca: 'Licencia', epoca: 'Temporada', noturna: 'Pesca nocturna', devolucao: 'Devolución obligatoria', gestor: 'Gestor', horario: 'Horario', presenca: 'Presencia', acesso: 'Acceso a la orilla', localizacao: 'Ubicación', fontes: 'Fuentes', verificado: 'Verificado el', semVerif: 'Sin verificación independiente registrada', importado: 'Importado el', naoVerif: '(importación, no es verificación)', linha: 'Origen', marcar: 'Marcar pin aquí', jornada: 'Preparar jornada', enquadrar: 'Encuadrar', fechar: 'Cerrar ficha', porque: 'Por qué', planear: 'Puede planificar la jornada; confirme las condiciones en el lugar.', confirmar: 'Antes de planificar, falta confirmar:', proibido: 'La fuente competente prohíbe esta pesca en esta fecha.', previsao: 'Previsión meteorológica', previsto: 'Previsto (modelo), no observado', semPrev: 'Sin previsión para esta fecha.', navegar: 'Navegar hasta el punto documentado', idioma: 'Idioma de la ficha', original: 'documento en', documentado: 'Lo que está documentado', base: 'Base documental', regras: 'Acceso y condiciones', regDevolucao: 'Devolución de la carpa', vigencia: 'Vigencia', semDatas: 'sin fechas en la fuente', textoFonte: 'texto de la fuente, sin traducir' },
}

export function StateBadge({ state, lang }: { state: PermissionState; lang: Lang }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[13px] font-extrabold text-[#071923]" style={{ background: STATE_COLOR[state] }} data-carp-state={state}>
      <span aria-hidden className="text-[15px] leading-none">{STATE_GLYPH[state]}</span>
      {T[lang].state[state]}
    </span>
  )
}

/** Domínio do documento, quando a fonte não indica o organismo (não se infere o organismo). */
const hostOf = (url: string | null | undefined) => {
  try {
    return url ? new URL(url).hostname.replace(/^www\./, '') : null
  } catch {
    return null
  }
}

export function CarpSheet({ idx, sectorKey, date, activity, lang, signedIn, onDate, onActivity, onLang, onClose, onMark, onFrame }: {
  idx: CarpIndex
  sectorKey: string
  date: string
  activity: Activity
  lang: Lang
  signedIn: boolean
  onDate: (d: string) => void
  onActivity: (a: Activity) => void
  onLang: (l: Lang) => void
  onClose: () => void
  onMark: () => void
  onFrame: () => void
}) {
  const s = idx.sector.get(sectorKey)
  const w = s ? idx.water.get(s.waterKey) : null
  const anchor = s ? anchorOf(idx, s) : null
  const [wx, setWx] = useState<{ k: string; r: ConditionsResponse | null; err: boolean } | null>(null)
  const wxKey = anchor ? `${anchor.join(',')}|${date}` : ''
  useEffect(() => {
    if (!anchor || !signedIn) return
    let alive = true
    conditions({ lat: anchor[1], lng: anchor[0], date, timezone: w?.country === 'ES' ? 'Europe/Madrid' : 'Europe/Lisbon' })
      .then((r) => alive && setWx({ k: wxKey, r, err: false }))
      .catch(() => alive && setWx({ k: wxKey, r: null, err: true }))
    return () => {
      alive = false
    }
    // `wxKey` resume ponto e data.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wxKey, signedIn])
  if (!s || !w)
    return (
      <div className="space-y-2" data-carp-sheet="missing">
        <p className="text-[14px] font-bold">{lang === 'es' ? 'Lugar no encontrado en el catálogo' : 'Local não encontrado no catálogo'}</p>
        <button type="button" onClick={onClose} className="press min-h-11 rounded-full bg-white/10 px-4 text-[13px] font-bold">{L[lang].fechar}</button>
      </div>
    )
  const c = classify(idx.cat, s.waterKey, s, date, activity)
  const t = L[lang]
  const src = new Map(idx.cat.sources.map((x) => [x.key, x]))
  const usedSources = [...new Set([...c.permission.rules.map((r) => r.sourceKey), ...c.presence.evidence.map((e) => e.sourceKey), ...c.access.entries.map((a) => a.sourceKey)].filter(Boolean) as string[])].map((k) => src.get(k)!).filter(Boolean)
  const cond = c.permission.conditions
  // Tudo o que a fonte diz sobre este setor, mesmo quando não chega para «Pesca permitida».
  const documented = idx.cat.rules.filter((r) => r.waterKey === s.waterKey && (r.sectorKey === null || r.sectorKey === s.key) && (r.conditions.basis || r.conditions.notes || r.conditions.release))
  const wxNow = wx && wx.k === wxKey ? wx : null
  const daily = wxNow?.r?.available ? wxNow.r.data?.daily : undefined
  const row = 'flex justify-between gap-3 border-t border-white/8 py-1.5 text-[12.5px]'
  return (
    <div className="space-y-3" data-carp-sheet={s.key} data-carp-date={date} lang={lang === 'es' ? 'es' : 'pt-PT'}>
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-extrabold uppercase tracking-[0.12em] text-[#e6c36a]">{t.local}</p>
          <h2 className="font-display text-[19px] font-semibold leading-tight">{w.name}</h2>
          <p className="text-[13px] text-[#b5c5cc]">{s.name}{w.province ? ` · ${w.province}` : ''} · {w.country === 'PT' ? 'Portugal' : 'España'}</p>
        </div>
        <div className="flex rounded-full border border-white/12 p-0.5 text-[12px] font-bold" role="group" aria-label={t.idioma}>
          {(['pt', 'es'] as const).map((l) => (
            <button key={l} type="button" aria-pressed={lang === l} onClick={() => onLang(l)} className={cx('min-h-9 rounded-full px-2.5', lang === l ? 'bg-white text-[#071923]' : '')}>{l.toUpperCase()}</button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10" aria-label={t.fechar}>
          <X className="h-5 w-5" aria-hidden />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <label className="text-[11.5px] font-bold text-[#b5c5cc]">
          {t.data}
          <input type="date" value={date} onChange={(e) => e.target.value && onDate(e.target.value)} className="mt-1 h-11 w-full rounded-xl border border-white/12 bg-[#071923] px-2 text-[14px] text-[#f4f7f8]" data-carp-date-input />
        </label>
        <label className="text-[11.5px] font-bold text-[#b5c5cc]">
          {t.modalidade}
          <select value={activity} onChange={(e) => onActivity(e.target.value as Activity)} className="mt-1 h-11 w-full rounded-xl border border-white/12 bg-[#071923] px-2 text-[14px] text-[#f4f7f8]">
            {ACTIVITIES.map((a) => <option key={a} value={a}>{T[lang].activity[a]}</option>)}
          </select>
        </label>
      </div>

      <div className="space-y-1.5 rounded-2xl border border-white/10 p-3" aria-live="polite">
        <StateBadge state={c.permission.state} lang={lang} />
        <p className="text-[12.5px]">{c.permission.state === 'permitida' ? t.planear : c.permission.state === 'proibida' ? t.proibido : t.confirmar}</p>
        {c.permission.state === 'por-confirmar' && (
          <ul className="list-disc space-y-0.5 pl-5 text-[12.5px] text-[#d7e2e6]" aria-label={t.porque}>
            {c.permission.reasons.slice(0, 4).map((r, i) => <li key={i}>{T[lang].reason(r, lang)}</li>)}
          </ul>
        )}
        {cond && (
          <dl className="mt-1">
            <p className="text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-[#83e5ef]">{t.condicoes}</p>
            {cond.licence && <div className={row}><dt>{t.licenca}</dt><dd className="text-right font-bold">{cond.licence}</dd></div>}
            {cond.season && <div className={row}><dt>{t.epoca}</dt><dd className="text-right font-bold">{cond.season}</dd></div>}
            <div className={row}><dt>{t.noturna}</dt><dd className="text-right font-bold">{triText(cond.night, lang)}</dd></div>
            {!(cond.release && cond.catchAndRelease === 'desconhecido') && <div className={row}><dt>{t.devolucao}</dt><dd className="text-right font-bold">{triText(cond.catchAndRelease, lang)}</dd></div>}
            {cond.manager && <div className={row}><dt>{t.gestor}</dt><dd className="text-right font-bold">{cond.manager}</dd></div>}
            {cond.hours && <div className={row}><dt>{t.horario}</dt><dd className="text-right font-bold">{cond.hours}</dd></div>}
          </dl>
        )}
      </div>

      {documented.length > 0 && (
        <div className="space-y-1.5 rounded-2xl border border-white/8 p-3 text-[12.5px]" data-carp-documented>
          <p className="text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-[#83e5ef]">{t.documentado}</p>
          {documented.map((r) => (
            <dl key={r.key} lang="pt-PT">
              {r.conditions.basis && <div className={row}><dt>{t.base}</dt><dd className="text-right font-bold">{r.conditions.basis}</dd></div>}
              <div className={row}><dt>{t.vigencia}</dt><dd className="text-right">{r.validFrom || r.validTo ? `${r.validFrom ?? '…'} → ${r.validTo ?? '…'}` : t.semDatas}</dd></div>
              {r.conditions.notes && <div className={row}><dt>{t.regras}</dt><dd className="text-right">{r.conditions.notes}</dd></div>}
              {r.conditions.release && <div className={row}><dt>{t.regDevolucao}</dt><dd className="text-right" data-carp-release>{r.conditions.release}</dd></div>}
            </dl>
          ))}
          {lang === 'es' && <p className="text-[11px] text-[#b5c5cc]">{t.textoFonte}</p>}
        </div>
      )}

      <dl className="text-[12.5px]">
        <div className={row}><dt>{t.presenca}</dt><dd className="text-right font-bold" data-carp-presence={c.presence.state}>{T[lang].presence[c.presence.state]}</dd></div>
        <div className={row}><dt>{t.acesso}</dt><dd className="text-right font-bold" data-carp-access={c.access.state}>{T[lang].access[c.access.state]}{c.access.entries[0]?.text ? ` · «${c.access.entries[0].text}»` : ''}</dd></div>
        <div className={row}><dt>{t.localizacao}</dt><dd className="text-right font-bold" data-carp-precision={s.precision}>{T[lang].precision[s.precision]}</dd></div>
        {s.limitsText && <div className={row}><dt />{/* limites tal como na fonte */}<dd className="text-right text-[#b5c5cc]">«{s.limitsText}»</dd></div>}
      </dl>

      {anchor && (
        <div className="rounded-2xl bg-white/5 p-3 text-[12.5px]">
          <p className="font-extrabold">{t.previsao}</p>
          {!signedIn ? (
            <p className="text-[#b5c5cc]">{lang === 'es' ? 'Entre en la cuenta para ver la previsión.' : 'Entre na conta para ver a previsão.'}</p>
          ) : !wxNow ? (
            <p className="flex items-center gap-1.5 text-[#b5c5cc]"><Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden /> …</p>
          ) : daily ? (
            <p>
              {`${daily.temperature_2m_min?.[0] ?? '—'}–${daily.temperature_2m_max?.[0] ?? '—'} °C (ar) · ${lang === 'es' ? 'viento' : 'vento'} ${daily.wind_speed_10m_max?.[0] ?? '—'} km/h · ${lang === 'es' ? 'prob. lluvia' : 'prob. chuva'} ${daily.precipitation_probability_max?.[0] ?? '—'}%`}
              <span className="block text-[11.5px] text-[#b5c5cc]">{wxNow.r?.kind === 'previsao' ? t.previsto : wxNow.r?.kind === 'historico' ? (lang === 'es' ? 'Reanálisis (pasado)' : 'Reanálise (passado)') : (lang === 'es' ? 'Estimado por modelo' : 'Estimado por modelo')} · Open-Meteo</span>
            </p>
          ) : (
            <p className="text-[#b5c5cc]">{wxNow.r?.reason ?? t.semPrev}</p>
          )}
        </div>
      )}

      <div>
        <p className="text-[11.5px] font-extrabold uppercase tracking-[0.1em] text-[#83e5ef]">{t.fontes}</p>
        {usedSources.length ? (
          <ul className="mt-1 space-y-1.5 text-[12.5px]" data-carp-sources>
            {usedSources.map((x) => (
              <li key={x.key} className="rounded-xl border border-white/8 p-2" lang={x.lang ?? undefined}>
                <span className="font-bold">{x.organism ?? hostOf(x.url) ?? '—'}</span>
                {x.ref ? ` · ${x.ref}` : ''}
                {x.lang ? <span className="text-[#b5c5cc]"> · {t.original} {x.lang.toUpperCase()}</span> : null}
                {x.url && (
                  <a href={x.url} target="_blank" rel="noreferrer noopener" className="ml-1 inline-flex items-center gap-1 font-bold text-[#83e5ef] underline">
                    URL <ExternalLink className="h-3 w-3" aria-hidden />
                  </a>
                )}
                <span className="block text-[11.5px] text-[#b5c5cc]">{x.verifiedAt ? `${t.verificado} ${x.verifiedAt}` : t.semVerif}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12.5px] text-[#b5c5cc]">—</p>
        )}
        <p className="mt-1 text-[11px] text-[#7f97a1]">
          {t.linha}: {s.provenance.map((p) => `${p.sheet}:${p.row}`).join(', ')}
          {idx.cat.edition ? ` · ${t.importado} ${idx.cat.edition.importedAt} ${t.naoVerif}` : ''}
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onMark} className="press inline-flex min-h-12 items-center gap-2 rounded-full bg-[#38c9d5] px-4 text-[14px] font-extrabold text-[#071923]" data-action="carpa-marcar-pin">
          <MapPinPlus className="h-5 w-5" aria-hidden /> {t.marcar}
        </button>
        <Link
          to={`/conta/jornadas/nova?${new URLSearchParams({ nome: `${w.name} · ${s.name}`, data: date, setor: s.key, ...(w.atlasId ? { agua: w.atlasId } : {}), ...(anchor ? { lng: String(anchor[0]), lat: String(anchor[1]) } : {}) })}`}
          className="press inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-4 text-[13px] font-bold"
          data-action="carpa-jornada"
        >
          <CalendarPlus className="h-4 w-4" aria-hidden /> {t.jornada}
        </Link>
        {anchor && (
          <button type="button" onClick={onFrame} className="press inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-4 text-[13px] font-bold">
            <Crosshair className="h-4 w-4" aria-hidden /> {t.enquadrar}
          </button>
        )}
        {anchor && c.access.state === 'publico' && (
          <a href={`https://www.openstreetmap.org/directions?to=${anchor[1]},${anchor[0]}`} target="_blank" rel="noreferrer noopener" className="press inline-flex min-h-12 items-center gap-2 rounded-full border border-white/15 px-4 text-[13px] font-bold">
            <Navigation className="h-4 w-4" aria-hidden /> {t.navegar}
          </a>
        )}
      </div>
    </div>
  )
}

/** Lista e filtros da camada (inclui locais sem coordenadas). */
export function CarpPanel({ idx, error, onRetry, date, activity, lang, onOpen }: { idx: CarpIndex | null; error: boolean; onRetry: () => void; date: string; activity: Activity; lang: Lang; onOpen: (key: string, hasGeo: boolean) => void }) {
  const [q, setQ] = useState('')
  const [f, setF] = useState<CarpFilter>({ country: null, type: null, state: null })
  if (error)
    return (
      <p className="rounded-2xl bg-amber-50 p-3 text-[12.5px] font-semibold text-amber-900" role="alert">
        {lang === 'es' ? 'No fue posible cargar el catálogo de la carpa.' : 'Não foi possível carregar o catálogo da carpa.'}{' '}
        <button type="button" className="underline" onClick={onRetry}>{lang === 'es' ? 'Reintentar' : 'Tentar de novo'}</button>
      </p>
    )
  if (!idx) return <p className="flex items-center gap-2 py-3 text-[13px] text-[#b5c5cc]"><Loader2 className="h-4 w-4 animate-spin" aria-hidden /> …</p>
  if (!idx.cat.edition)
    return (
      <div className="rounded-2xl border border-white/10 p-3 text-[13px]" data-carp-empty>
        <p className="font-bold">{lang === 'es' ? 'Catálogo de la carpa por importar' : 'Catálogo da carpa por importar'}</p>
        <p className="mt-1 text-[12.5px] text-[#b5c5cc]">{lang === 'es' ? 'Todavía no se ha importado ninguna edición del Excel.' : 'Ainda não foi importada nenhuma edição do Excel do Atlas da Carpa.'}</p>
      </div>
    )
  const items = searchCarp(idx, q, f, date, activity, 200)
  const chip = (on: boolean) => cx('press min-h-10 rounded-full border px-3 text-[12.5px] font-bold', on ? 'border-[#e6c36a] bg-[#e6c36a] text-[#071923]' : 'border-white/15')
  return (
    <div className="space-y-2" data-carp-panel>
      <input value={q} onChange={(e) => setQ(e.target.value)} type="search" placeholder={lang === 'es' ? 'Buscar agua o tramo' : 'Pesquisar água ou setor'} aria-label={lang === 'es' ? 'Buscar agua o tramo' : 'Pesquisar água ou setor'} className="h-11 w-full rounded-full border border-white/12 bg-[#071923] px-4 text-[14px]" data-carp-search />
      <div className="flex flex-wrap gap-1.5" role="group" aria-label={lang === 'es' ? 'Filtros' : 'Filtros'}>
        {(['PT', 'ES'] as const).map((c) => <button key={c} type="button" aria-pressed={f.country === c} className={chip(f.country === c)} onClick={() => setF({ ...f, country: f.country === c ? null : c })}>{c === 'PT' ? 'Portugal' : 'España'}</button>)}
        {(['permitida', 'por-confirmar', 'proibida'] as const).map((st) => <button key={st} type="button" aria-pressed={f.state === st} className={chip(f.state === st)} onClick={() => setF({ ...f, state: f.state === st ? null : st })}>{STATE_GLYPH[st]} {T[lang].state[st]}</button>)}
        <select value={f.type ?? ''} onChange={(e) => setF({ ...f, type: e.target.value || null })} aria-label={lang === 'es' ? 'Tipo' : 'Tipo'} className="h-10 rounded-full border border-white/15 bg-[#071923] px-3 text-[12.5px] font-bold">
          <option value="">{lang === 'es' ? 'Todos los tipos' : 'Todos os tipos'}</option>
          {[...new Set(idx.cat.waters.map((w) => w.type))].sort().map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>
      <p className="text-[12px] text-[#b5c5cc]" aria-live="polite" data-carp-count={items.length}>{items.length} {lang === 'es' ? 'tramos' : 'setores'}</p>
      {items.length === 0 ? (
        <p className="rounded-2xl border border-white/10 p-3 text-[13px] text-[#b5c5cc]" data-carp-zero>{lang === 'es' ? 'Sin resultados con estos filtros.' : 'Sem resultados com estes filtros.'}</p>
      ) : (
        <ul className="space-y-1" aria-label={lang === 'es' ? 'Tramos de la carpa' : 'Setores da carpa'}>
          {items.map((s) => {
            const w = idx.water.get(s.waterKey)!
            const st = stateOf(idx, s, date, activity)
            const geo = !!anchorOf(idx, s)
            return (
              <li key={s.key}>
                <button type="button" onClick={() => onOpen(s.key, geo)} className="press flex min-h-12 w-full items-center gap-2 rounded-2xl px-2 text-left hover:bg-white/5" data-carp-item={s.key}>
                  <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[14px] font-extrabold text-[#071923]" style={{ background: STATE_COLOR[st] }} aria-hidden>{STATE_GLYPH[st]}</span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[13.5px] font-bold">{w.name} · {s.name}</span>
                    <span className="block text-[11.5px] text-[#b5c5cc]">{T[lang].state[st]} · {geo ? (lang === 'es' ? 'Ver en el mapa 3D' : 'Ver no mapa 3D') : T[lang].precision['sem-coordenadas']}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}

/** Resultados «Carpa» dentro da pesquisa do Atlas (mesmo catálogo, mesma ficha). */
export function CarpSearchResults({ idx, query, date, activity, lang, onOpen }: { idx: CarpIndex | null; query: string; date: string; activity: Activity; lang: Lang; onOpen: (key: string, hasGeo: boolean) => void }) {
  if (!idx || !idx.cat.edition) return null
  const items = searchCarp(idx, query, { country: null, type: null, state: null }, date, activity, 8)
  if (!items.length) return null
  return (
    <div className="mt-3 border-t border-white/10 pt-3" data-carp-search-results>
      <p className="mb-1 text-[11.5px] font-extrabold uppercase tracking-[0.12em] text-[#e6c36a]">{T[lang].layer} · {items.length}</p>
      <ul className="space-y-1">
        {items.map((s) => {
          const w = idx.water.get(s.waterKey)!
          const geo = !!anchorOf(idx, s)
          const st = stateOf(idx, s, date, activity)
          return (
            <li key={s.key} className="flex items-center gap-2 rounded-2xl px-2 py-1">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full text-[14px] font-extrabold text-[#071923]" style={{ background: STATE_COLOR[st] }} aria-hidden>{STATE_GLYPH[st]}</span>
              <span className="min-w-0 flex-1 text-[13px]">
                <span className="block truncate font-bold">{w.name} · {s.name}</span>
                <span className="block text-[11.5px] text-[#b5c5cc]">{T[lang].state[st]}{geo ? '' : ` · ${T[lang].precision['sem-coordenadas']}`}</span>
              </span>
              <button type="button" onClick={() => onOpen(s.key, geo)} className="press min-h-11 shrink-0 rounded-full border border-white/15 px-3 text-[12.5px] font-bold" data-action="carpa-ver-mapa">
                {geo ? (lang === 'es' ? 'Ver en el mapa 3D' : 'Ver no mapa 3D') : lang === 'es' ? 'Ver información' : 'Ver informação'}
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
