import type { GeoJSONSource, Map as MLMap } from 'maplibre-gl'
import type { Feature } from 'geojson'

export interface ChunkInfo { key: string; bbox: [number, number, number, number]; count: number }
export interface ChunkIndex { source: { extractedAt: string; attribution: string; license: string; url: string; notes: string }; chunks: ChunkInfo[] }

const overlaps = (a: number[], b: number[]) => a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]

/**
 * Carrega, por área visível, os blocos de um conjunto (índice com a extensão real de cada bloco).
 * - `maxChunks`: cache limitada; os blocos fora da vista menos usados recentemente saem primeiro.
 * - Pedidos de blocos que deixaram de estar visíveis são cancelados no movimento seguinte.
 */
export function makeChunkLoader(map: MLMap, dir: string, sourceId: string, minZoom: () => number, opts: { maxChunks?: number } = {}) {
  const maxChunks = opts.maxChunks ?? Infinity
  let index: ChunkIndex | null = null
  let indexPromise: Promise<ChunkIndex | null> | null = null
  const loaded = new Map<string, unknown[]>()
  const pending = new Map<string, AbortController>()
  const getIndex = () =>
    index
      ? Promise.resolve(index)
      : (indexPromise ??= fetch(`${dir}/index.json`)
          .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
          .then((i: ChunkIndex) => (index = i))
          .catch(() => ((indexPromise = null), null)))
  const publish = () =>
    (map.getSource(sourceId) as GeoJSONSource | undefined)?.setData({ type: 'FeatureCollection', features: [...loaded.values()].flat() as Feature[] })
  return {
    setIndex: (i: ChunkIndex) => {
      index = i
    },
    count: () => loaded.size,
    busy: () => pending.size > 0,
    keys: () => [...loaded.keys()],
    /** Devolve false se algum pedido falhou (pedidos cancelados não contam como falha). */
    async loadVisible(): Promise<boolean> {
      if (map.getZoom() < minZoom()) return true
      const idx = await getIndex()
      if (!idx) return false
      const b = map.getBounds()
      const vb = [b.getWest(), b.getSouth(), b.getEast(), b.getNorth()]
      const visible = new Set(idx.chunks.filter((c) => overlaps(c.bbox, vb)).map((c) => c.key))
      for (const [k, ctl] of pending) if (!visible.has(k)) ctl.abort()
      // Recência: os blocos visíveis passam para o fim da ordem de despejo.
      for (const k of visible) {
        const v = loaded.get(k)
        if (v) {
          loaded.delete(k)
          loaded.set(k, v)
        }
      }
      const need = idx.chunks.filter((c) => visible.has(c.key) && !loaded.has(c.key) && !pending.has(c.key))
      if (!need.length) return true
      const ctls = need.map((c) => {
        const ctl = new AbortController()
        pending.set(c.key, ctl)
        return ctl
      })
      const results = await Promise.allSettled(
        need.map((c, i) => fetch(`${dir}/${c.key}.geojson`, { signal: ctls[i].signal }).then((r) => (r.ok ? r.json() : Promise.reject(r.status)))),
      )
      results.forEach((r, i) => {
        pending.delete(need[i].key)
        if (r.status === 'fulfilled') loaded.set(need[i].key, r.value.features)
      })
      for (const k of loaded.keys()) {
        if (loaded.size <= maxChunks) break
        if (!visible.has(k)) loaded.delete(k)
      }
      publish()
      return !results.some((r, i) => r.status === 'rejected' && !ctls[i].signal.aborted)
    },
  }
}
