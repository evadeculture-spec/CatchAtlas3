import { Crosshair, Loader2, MapPin } from 'lucide-react'
import { useState } from 'react'
import { formatCoords, getDevicePosition, parseCoords } from '../../lib/lanca/geo'
import type { Pin } from '../../lib/lanca/types'
import { Button, cx, inputCls } from '../ui'
import { PrivateMap } from './PrivateMap'

export interface PickedLocation {
  lat: number
  lng: number
  accuracy: number | null
  source: 'gps' | 'mapa' | 'manual' | 'foto' | 'pin'
  measuredAt: string | null
}

/**
 * Escolha de localização: toque no mapa (ou arraste o marcador), GPS a pedido ou coordenadas escritas.
 * O GPS só é pedido quando o utilizador carrega no botão (nunca em segundo plano).
 */
export function LocationPicker({ value, onChange, pins = [], className, mapClassName = 'h-72' }: { value: PickedLocation | null; onChange: (v: PickedLocation) => void; pins?: Pin[]; className?: string; mapClassName?: string }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const [fly, setFly] = useState<{ lat: number; lng: number; zoom?: number; key: number } | null>(null)

  const useGps = async () => {
    setBusy(true)
    setErr(null)
    try {
      const p = await getDevicePosition()
      onChange({ lat: p.lat, lng: p.lng, accuracy: p.accuracy, source: 'gps', measuredAt: p.at })
      setFly({ lat: p.lat, lng: p.lng, zoom: 15, key: Date.now() })
    } catch (e) {
      setErr((e as Error).message)
    } finally {
      setBusy(false)
    }
  }
  const applyManual = () => {
    const c = parseCoords(manual)
    if (!c) return setErr('Coordenadas inválidas. Exemplo: 39.4612, -8.1977')
    setErr(null)
    onChange({ ...c, accuracy: null, source: 'manual', measuredAt: null })
    setFly({ ...c, zoom: 15, key: Date.now() })
  }
  return (
    <div className={className}>
      <div className={cx('relative overflow-hidden rounded-[var(--radius-card)] border border-line', mapClassName)}>
        <PrivateMap pins={pins} showPings={false} className="absolute inset-0" label="Mapa para escolher a localização" flyTo={fly} fitKey={value ? 'pick' : 'pins'} pick={{ value, onChange: (v) => onChange({ ...v, accuracy: null, source: 'mapa', measuredAt: null }) }} />
        {!value && <p className="pointer-events-none absolute inset-x-0 top-3 mx-auto w-fit rounded-full bg-ink/85 px-3 py-1.5 text-[12px] font-bold text-white">Toque no mapa para marcar o local</p>}
      </div>
      <div className="mt-2.5 flex flex-wrap items-center gap-2">
        <Button size="sm" variant="outline" icon={busy ? Loader2 : Crosshair} onClick={useGps} disabled={busy} className={busy ? '[&_svg]:animate-spin' : ''}>
          {busy ? 'A localizar…' : 'Usar a minha posição'}
        </Button>
        {value && (
          <span className="inline-flex items-center gap-1.5 text-[12.5px] font-semibold text-muted">
            <MapPin className="h-3.5 w-3.5" aria-hidden />
            <span className="tnum">{formatCoords(value.lat, value.lng)}</span>
            {value.accuracy != null && <span>· ±{value.accuracy} m</span>}
          </span>
        )}
      </div>
      <details className="mt-2">
        <summary className="cursor-pointer text-[12.5px] font-bold text-teal-700">Escrever coordenadas</summary>
        <div className="mt-2 flex gap-2">
          <input value={manual} onChange={(e) => setManual(e.target.value)} placeholder="39.4612, -8.1977" className={inputCls} inputMode="decimal" aria-label="Coordenadas (latitude, longitude)" />
          <Button variant="dark" onClick={applyManual}>
            Aplicar
          </Button>
        </div>
      </details>
      {err && (
        <p className="mt-2 text-[12.5px] font-semibold text-danger" role="alert">
          {err}
        </p>
      )}
      <p className="mt-2 text-[11.5px] leading-snug text-subtle">A localização fica privada na sua conta. Só é partilhada com o serviço meteorológico arredondada a ~1 km.</p>
    </div>
  )
}
