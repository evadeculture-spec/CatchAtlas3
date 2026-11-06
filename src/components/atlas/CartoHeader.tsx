import { useEffect, useState } from 'react'
import type { AtlasFeature } from '../../lib/atlas/model'

type Pos = [number, number]
type Geom = { type: 'Polygon'; coordinates: Pos[][] } | { type: 'MultiPolygon'; coordinates: Pos[][][] } | { type: 'LineString'; coordinates: Pos[] } | { type: 'Point'; coordinates: Pos }

const geomCache = new Map<string, Promise<Geom[] | null>>()
const fileCache = new Map<string, Promise<{ features: { properties: Record<string, unknown>; geometry: Geom }[] } | null>>()
const getFile = (url: string) => {
  if (!fileCache.has(url))
    fileCache.set(
      url,
      fetch(url)
        .then((r) => (r.ok ? r.json() : null))
        .catch(() => null),
    )
  return fileCache.get(url)!
}

/** Geometria de um elemento do registo (do mesmo ficheiro que o mapa usa; em cache no navegador). */
export function loadGeometry(f: AtlasFeature): Promise<Geom[] | null> {
  const key = f.id
  if (geomCache.has(key)) return geomCache.get(key)!
  let p: Promise<Geom[] | null>
  if (f.geometryRef.layer === 'water' && f.geometryRef.chunk)
    p = getFile(`/map/water/${f.geometryRef.chunk}.geojson`).then((fc) => fc?.features.filter((x) => x.properties.kind === 'area' && x.properties.id === f.id).map((x) => x.geometry) ?? null)
  else if (f.geometryRef.layer === 'rivers') p = getFile('/map/atlas/rivers.geojson').then((fc) => fc?.features.filter((x) => x.properties.river === f.id).map((x) => x.geometry) ?? null)
  else p = Promise.resolve([{ type: 'Point', coordinates: f.point }])
  geomCache.set(key, p)
  return p
}

const fmtCoord = (v: number, pos: string, neg: string) => `${Math.abs(v).toLocaleString('pt-PT', { maximumFractionDigits: 2, minimumFractionDigits: 2 })}° ${v >= 0 ? pos : neg}`

/**
 * Cabeçalho cartográfico (quando não há fotografia do próprio local): a silhueta real da massa de
 * água ou do rio, à escala, com coordenadas e barra de escala.
 */
export function CartoHeader({ feature, highlightSection }: { feature: AtlasFeature; highlightSection?: string }) {
  const [geoms, setGeoms] = useState<Geom[] | null | undefined>(undefined)
  const [sections, setSections] = useState<{ id: string; coords: Pos[] }[]>([])
  useEffect(() => {
    let alive = true
    loadGeometry(feature).then((g) => alive && setGeoms(g))
    if (feature.type === 'rio')
      getFile('/map/atlas/rivers.geojson').then(
        (fc) => alive && setSections(fc?.features.filter((x) => x.properties.river === feature.id).map((x) => ({ id: String(x.properties.id), coords: (x.geometry as { coordinates: Pos[] }).coordinates })) ?? []),
      )
    return () => {
      alive = false
    }
  }, [feature])

  const W = 360, H = 132, PAD = 18
  const [w, s, e, n] = feature.bbox
  const lat0 = ((s + n) / 2) * (Math.PI / 180)
  const kx = Math.cos(lat0)
  const spanX = Math.max((e - w) * kx, 0.004)
  const spanY = Math.max(n - s, 0.004)
  const scale = Math.min((W - PAD * 2) / spanX, (H - PAD * 2) / spanY)
  const cx = (w + e) / 2, cy = (s + n) / 2
  const pt = ([x, y]: Pos) => [W / 2 + (x - cx) * kx * scale, H / 2 - (y - cy) * scale] as const
  const ring = (r: Pos[]) => r.map((p, i) => `${i ? 'L' : 'M'}${pt(p)[0].toFixed(1)},${pt(p)[1].toFixed(1)}`).join('') + 'Z'
  const line = (l: Pos[]) => l.map((p, i) => `${i ? 'L' : 'M'}${pt(p)[0].toFixed(1)},${pt(p)[1].toFixed(1)}`).join('')
  // Barra de escala: 1, 2, 5 × 10^n km que caiba em ~70 px.
  const kmPerPx = (111.32 / scale)
  const target = kmPerPx * 70
  const mag = 10 ** Math.floor(Math.log10(target))
  const nice = [1, 2, 5, 10].map((m) => m * mag).filter((v) => v <= target).pop() ?? mag
  const barPx = nice / kmPerPx
  const point = feature.geometryRef.layer === 'structures' || feature.geometryRef.layer === 'none'

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[radial-gradient(120%_90%_at_30%_20%,#123647_0%,#0b2230_55%,#071923_100%)]" aria-hidden>
      <svg viewBox={`0 0 ${W} ${H}`} className="block h-[132px] w-full">
        <defs>
          <pattern id="atlas-grid" width="24" height="24" patternUnits="userSpaceOnUse">
            <path d="M24 0H0V24" fill="none" stroke="rgba(181,197,204,0.07)" strokeWidth="1" />
          </pattern>
        </defs>
        <rect width={W} height={H} fill="url(#atlas-grid)" />
        {geoms === undefined && <rect x={W / 2 - 40} y={H / 2 - 2} width="80" height="4" rx="2" fill="rgba(181,197,204,0.18)" />}
        {point && <circle cx={W / 2} cy={H / 2} r="7" fill="#f4f7f8" stroke="#071923" strokeWidth="2" />}
        {point && <circle cx={W / 2} cy={H / 2} r="16" fill="none" stroke="rgba(131,229,239,0.55)" strokeWidth="1.5" />}
        {!point &&
          geoms?.map((g, i) =>
            g.type === 'Polygon' ? (
              <path key={i} d={g.coordinates.map(ring).join('')} fillRule="evenodd" fill="#38c9d5" stroke="#83e5ef" strokeWidth="1" />
            ) : g.type === 'MultiPolygon' ? (
              <path key={i} d={g.coordinates.flatMap((p) => p.map(ring)).join('')} fillRule="evenodd" fill="#38c9d5" stroke="#83e5ef" strokeWidth="1" />
            ) : null,
          )}
        {feature.type === 'rio' &&
          sections.map((sct) => (
            <path key={sct.id} d={line(sct.coords)} fill="none" stroke={sct.id === highlightSection ? '#83e5ef' : '#2fb6c3'} strokeWidth={sct.id === highlightSection ? 3.2 : 1.8} strokeLinecap="round" strokeLinejoin="round" />
          ))}
      </svg>
      <div className="pointer-events-none absolute inset-x-3 bottom-2 flex items-end justify-between text-[10.5px] font-semibold tracking-wide text-[#b5c5cc]/80">
        <span className="tnum">
          {fmtCoord(feature.point[1], 'N', 'S')} · {fmtCoord(feature.point[0], 'E', 'W')}
        </span>
        {!point && (
          <span className="flex flex-col items-end gap-0.5">
            <span className="block h-[3px] rounded-full bg-[#b5c5cc]/70" style={{ width: barPx }} />
            <span className="tnum">{nice.toLocaleString('pt-PT')} km</span>
          </span>
        )}
      </div>
    </div>
  )
}
