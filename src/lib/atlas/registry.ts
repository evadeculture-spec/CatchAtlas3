import { useEffect, useState } from 'react'
import catalogLinksJson from '../../data/atlas/catalogLinks.json'
import { ZONES } from '../../data/zones'
import zoneWaterJson from '../../data/map/zoneWater.json'
import { decodeRegistry, type AtlasFeature, type AtlasRegistry, type CatalogLink, type RegistryFile } from './model'

/** Tabela ficha ↔ cartografia (gerada e auditável; ver src/data/atlas/catalogLinks.json). */
export const CATALOG_LINKS = catalogLinksJson as CatalogLink[]
export const linkByCatalog = new Map(CATALOG_LINKS.map((l) => [l.catalogId, l]))
/** ID do registo do atlas para uma ficha: a albufeira ligada ou a entrada "ficha-<id>" (sem contorno). */
export const atlasIdForCatalog = (catalogId: string) => linkByCatalog.get(catalogId)?.atlasId ?? `ficha-${catalogId}`

type ZoneWater = Record<string, { waterId: string; name: string; label: [number, number]; bbox: number[]; partial: boolean }[]>
export const ZONE_WATER = zoneWaterJson as unknown as ZoneWater
/** Zonas de pesca documentadas associadas a cada albufeira. */
export const zonesForWater = (waterId: string) =>
  Object.entries(ZONE_WATER)
    .filter(([, ws]) => ws.some((w) => w.waterId === waterId))
    .map(([zid]) => ({ zone: ZONES.find((z) => z.id === zid)!, partial: ZONE_WATER[zid].some((w) => w.waterId === waterId && w.partial) }))
    .filter((z) => z.zone)

export interface LoadedRegistry extends AtlasRegistry {
  byId: Map<string, AtlasFeature>
}

let cache: Promise<LoadedRegistry> | null = null

/** Registo do atlas (descarregado uma vez, só quando é preciso). */
export function loadRegistry(): Promise<LoadedRegistry> {
  cache ??= fetch('/map/atlas/registry.json')
    .then((r) => (r.ok ? (r.json() as Promise<RegistryFile>) : Promise.reject(new Error(`registo: HTTP ${r.status}`))))
    .then((f) => {
      const reg = decodeRegistry(f)
      return { ...reg, byId: new Map(reg.items.map((i) => [i.id, i])) }
    })
    .catch((e) => {
      cache = null
      throw e
    })
  return cache
}

/** Hook: registo + estado. `enabled` adia o download até ser necessário. */
export function useRegistry(enabled: boolean) {
  const [state, setState] = useState<{ reg: LoadedRegistry | null; error: boolean }>({ reg: null, error: false })
  const [attempt, setAttempt] = useState(0)
  useEffect(() => {
    if (!enabled || state.reg) return
    let alive = true
    loadRegistry().then(
      (reg) => alive && setState({ reg, error: false }),
      () => alive && setState({ reg: null, error: true }),
    )
    return () => {
      alive = false
    }
  }, [enabled, state.reg, attempt])
  return { ...state, retry: () => setAttempt((n) => n + 1) }
}

/** Estrutura do mapa → ID do registo (a estrutura pode ter o sufixo "-estrutura"; ver structureAtlasId). */
export function registryIdForStructure(reg: LoadedRegistry | null, mapId: string) {
  if (!reg) return mapId
  const a = reg.byId.get(mapId)
  if (a && (a.type === 'barragem' || a.type === 'acude')) return mapId
  return reg.byId.has(`${mapId}-estrutura`) ? `${mapId}-estrutura` : mapId
}
