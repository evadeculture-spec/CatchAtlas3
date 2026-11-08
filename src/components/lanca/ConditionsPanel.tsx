import { Cloud, Moon, RefreshCw, Sun, Waves } from 'lucide-react'
import { useEffect, useState } from 'react'
import { listDataSources } from '../../lib/lanca/api'
import { ENRICHMENT } from '../../lib/lanca/labels'
import { moonPhaseName } from '../../lib/lanca/moon'
import { formatDateTime, formatTime } from '../../lib/lanca/time'
import type { DataSource, EnrichmentStatus, PingEnvironment } from '../../lib/lanca/types'
import { compass, fmt, weatherLabel, type Units } from '../../lib/lanca/units'
import { Button, Tag } from '../ui'
import { KindBadge, KV, Notice, Panel, Spinner } from './primitives'

let sourcesCache: Promise<DataSource[]> | null = null
export function useDataSources() {
  const [list, setList] = useState<DataSource[]>([])
  useEffect(() => {
    sourcesCache ??= listDataSources().catch(() => {
      sourcesCache = null
      return []
    })
    let alive = true
    sourcesCache.then((l) => alive && setList(l))
    return () => {
      alive = false
    }
  }, [])
  return list
}

/** Condições do momento do Ping, com a natureza e a fonte de cada grupo de dados. */
export function ConditionsPanel({ env, status, error, tz, units, onRetry, retrying }: { env: PingEnvironment | null; status: EnrichmentStatus; error?: string | null; tz: string; units: Units; onRetry?: () => void; retrying?: boolean }) {
  const sources = useDataSources()
  const src = (key: string) => sources.find((s) => s.key === key)
  if (status === 'sem-localizacao')
    return (
      <Panel title="Condições">
        <Notice>Este Ping não tem localização, por isso não é possível obter as condições do local. Adicione a localização para as obter.</Notice>
      </Panel>
    )
  if (!env || status === 'pendente' || status === 'em-curso')
    return (
      <Panel title="Condições" actions={onRetry && status !== 'em-curso' ? <Button size="sm" variant="ghost" icon={RefreshCw} onClick={onRetry} disabled={retrying}>Obter</Button> : undefined}>
        {status === 'falhou' ? (
          <Notice tone="warn">Não foi possível obter as condições ({error ?? 'fornecedor indisponível'}). O Ping está guardado; pode tentar de novo mais tarde.</Notice>
        ) : (
          <Spinner label="A obter as condições do momento do acontecimento…" />
        )}
      </Panel>
    )
  const meteo = env.sources?.find((s) => s.group === 'meteorologia')
  const marine = env.sources?.find((s) => s.group === 'mar')
  const offset = env.time_offset_min ?? 0
  return (
    <Panel
      title="Condições do momento"
      actions={
        <>
          <Tag tone={ENRICHMENT[status].tone}>{ENRICHMENT[status].label}</Tag>
          {onRetry && (status === 'falhou' || status === 'parcial') && <Button size="sm" variant="ghost" icon={RefreshCw} onClick={onRetry} disabled={retrying} aria-label="Tentar de novo" />}
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <div className="mb-1 flex flex-wrap items-center gap-2">
            <Cloud className="h-4 w-4 text-muted" aria-hidden />
            <h3 className="text-[13.5px] font-extrabold text-ink">Meteorologia</h3>
            {meteo ? <KindBadge kind={meteo.data_kind as 'estimado'} /> : <KindBadge kind="indisponivel" />}
          </div>
          {meteo ? (
            <>
              <p className="mb-1 text-[11.5px] leading-snug text-subtle">
                {src(meteo.source)?.name ?? meteo.source} · hora de referência {env.reference_time ? formatDateTime(env.reference_time, tz) : '—'}
                {offset ? ` (${Math.abs(offset)} min ${offset > 0 ? 'depois' : 'antes'} do acontecimento)` : ''} · célula de ~1 km{env.grid_elevation_m != null ? ` a ${Math.round(env.grid_elevation_m)} m de altitude` : ''}
              </p>
              <dl>
                <KV label="Estado do tempo" value={weatherLabel(env.weather_code)} />
                <KV label="Temperatura do ar" value={fmt.temp(env.air_temp_c, units)} />
                <KV label="Sensação térmica" value={fmt.temp(env.apparent_temp_c, units)} />
                <KV label="Humidade relativa" value={fmt.pct(env.humidity_pct)} />
                <KV label="Pressão (nível do mar)" value={fmt.pressure(env.pressure_hpa)} />
                <KV label="Tendência da pressão (3 h)" value={env.pressure_trend_3h_hpa == null ? null : `${env.pressure_trend_3h_hpa > 0 ? '+' : ''}${fmt.num(env.pressure_trend_3h_hpa)} hPa`} />
                <KV label="Vento" value={env.wind_kmh == null ? null : `${fmt.wind(env.wind_kmh, units)}${env.wind_dir_deg != null ? ` de ${compass(env.wind_dir_deg)}` : ''}`} />
                <KV label="Rajadas" value={fmt.wind(env.gust_kmh, units)} />
                <KV label="Precipitação (hora)" value={fmt.mm(env.precip_mm)} />
                <KV label="Precipitação (24 h)" value={fmt.mm(env.precip_24h_mm)} />
                <KV label="Nebulosidade" value={fmt.pct(env.cloud_cover_pct)} />
                <KV label="Visibilidade" value={env.visibility_m == null ? null : env.visibility_m >= 1000 ? `${fmt.num(env.visibility_m / 1000, 1)} km` : `${env.visibility_m} m`} hint="Não disponível no arquivo de reanálise." />
                <KV label="Índice UV" value={env.uv_index == null ? null : fmt.num(env.uv_index, 1)} />
              </dl>
            </>
          ) : (
            <Notice tone="warn">Sem dados meteorológicos para a hora deste acontecimento. Nenhum valor foi estimado a partir de outras horas.</Notice>
          )}
        </div>

        <div>
          <div className="mb-1 flex items-center gap-2">
            <Sun className="h-4 w-4 text-muted" aria-hidden />
            <h3 className="text-[13.5px] font-extrabold text-ink">Sol e Lua</h3>
            <KindBadge kind="calculado" />
          </div>
          <dl>
            <KV label="Nascer / pôr do sol" value={env.sunrise && env.sunset ? `${formatTime(env.sunrise, tz)} / ${formatTime(env.sunset, tz)}` : null} />
            <KV label="Duração do dia" value={env.day_length_min == null ? null : `${Math.floor(env.day_length_min / 60)} h ${env.day_length_min % 60} min`} />
            <KV label="Altura do sol" value={env.sun_altitude_deg == null ? null : `${fmt.num(env.sun_altitude_deg)}°`} />
            <KV label="Fase da lua" value={env.moon_phase == null ? null : `${moonPhaseName(env.moon_phase)} · ${Math.round((env.moon_illumination ?? 0) * 100)} % iluminada`} />
            <KV label="Nascer / pôr da lua" value={env.moonrise || env.moonset ? `${formatTime(env.moonrise, tz) ?? '—'} / ${formatTime(env.moonset, tz) ?? '—'}` : null} />
          </dl>
          <p className="mt-1 flex items-center gap-1.5 text-[11.5px] text-subtle">
            <Moon className="h-3 w-3" aria-hidden /> Indicadores astronómicos descrevem o céu; não garantem resultados na pesca.
          </p>
        </div>

        {(marine || env.wave_height_m != null) && (
          <div>
            <div className="mb-1 flex items-center gap-2">
              <Waves className="h-4 w-4 text-muted" aria-hidden />
              <h3 className="text-[13.5px] font-extrabold text-ink">Mar</h3>
              <KindBadge kind="estimado" />
            </div>
            <dl>
              <KV label="Altura das ondas" value={fmt.m(env.wave_height_m)} />
              <KV label="Período" value={env.wave_period_s == null ? null : `${fmt.num(env.wave_period_s)} s`} />
              <KV label="Direção da ondulação" value={compass(env.wave_dir_deg)} />
              <KV label="Temperatura da superfície do mar" value={fmt.temp(env.sea_temp_c, units)} />
              <KV label="Maré" value={null} hint="Marés oficiais ainda não integradas." />
            </dl>
          </div>
        )}

        <div>
          <div className="mb-1 flex items-center gap-2">
            <Waves className="h-4 w-4 text-muted" aria-hidden />
            <h3 className="text-[13.5px] font-extrabold text-ink">Água interior</h3>
            <KindBadge kind="indisponivel" />
          </div>
          <dl>
            <KV label="Temperatura da água" value={fmt.temp(env.water_temp_c, units)} />
            <KV label="Nível da água" value={fmt.m(env.water_level_m, 2)} />
            <KV label="Caudal" value={env.river_flow_m3s == null ? null : `${fmt.num(env.river_flow_m3s)} m³/s`} />
          </dl>
          <p className="mt-1 text-[11.5px] text-subtle">Sem fonte oficial integrada (SNIRH/APA, SAIH): estes campos ficam vazios em vez de usar estações distantes.</p>
        </div>

        <details className="rounded-2xl bg-mist px-3.5 py-2.5">
          <summary className="cursor-pointer text-[12.5px] font-bold text-ink">Fontes e qualidade dos dados</summary>
          <ul className="mt-2 space-y-2 text-[12px] leading-snug text-muted">
            {(env.sources ?? []).map((s) => {
              const d = src(s.source)
              return (
                <li key={`${s.group}-${s.source}`}>
                  <span className="font-bold text-ink">{d?.name ?? s.source}</span> — <KindBadge kind={s.data_kind} className="align-middle" />
                  {d?.attribution && <span className="block">{d.attribution}{d.license ? ` · ${d.license}` : ''}</span>}
                  {s.cached && <span className="block">Valor reutilizado da cache (sem novo pedido ao fornecedor).</span>}
                </li>
              )
            })}
            {env.quality?.grid_resolution && <li>Resolução: {env.quality.grid_resolution}. Coordenadas enviadas ao fornecedor arredondadas a 0,01° (~1 km).</li>}
            {!!env.quality?.errors?.length && <li className="text-amber-800">Avisos: {env.quality.errors.join(' · ')}</li>}
          </ul>
        </details>
      </div>
    </Panel>
  )
}
