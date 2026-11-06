/**
 * Tiles vetoriais MVT estáticos do Atlas (npm run atlas:tiles) — caminho de produção para crescer a
 * cobertura sem carregar GeoJSON grande. Gera dist-tiles/atlas/{z}/{x}/{y}.pbf + tiles.json a partir
 * dos mesmos dados do mapa (albufeiras OSM e rios do atlas), com simplificação por zoom (geojson-vt,
 * a mesma biblioteca que o MapLibre usa) e só os tiles com conteúdo.
 *
 * Estado: preparado e validado localmente (este script decodifica uma amostra). O mapa continua a usar
 * os blocos GeoJSON por área visível até os tiles estarem alojados (ver docs/ATLAS.md, "Produção").
 * Para um único ficheiro PMTiles: `pmtiles convert` (go-pmtiles) a partir de MBTiles, ou tippecanoe.
 */
import { mkdirSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GeoJSONVT } from '@maplibre/geojson-vt'
import { fromGeojsonVt } from '@maplibre/vt-pbf'
import { VectorTile } from '@mapbox/vector-tile'
import { PbfReader as Pbf } from 'pbf'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const OUT = join(ROOT, 'dist-tiles', 'atlas')
const MINZ = 4
const MAXZ = 12
type FC = { type: 'FeatureCollection'; features: { type: 'Feature'; properties: Record<string, unknown>; geometry: { type: string; coordinates: unknown } }[] }
const read = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as FC

const wdir = join(ROOT, 'public', 'map', 'water')
const water: FC = { type: 'FeatureCollection', features: [] }
for (const f of readdirSync(wdir).filter((n) => n.startsWith('c_') && n.endsWith('.geojson'))) water.features.push(...read(join(wdir, f)).features)
const rivers = read(join(ROOT, 'public', 'map', 'atlas', 'rivers.geojson'))

const opts = { maxZoom: MAXZ, indexMaxZoom: 5, indexMaxPoints: 100000, tolerance: 3, extent: 4096, buffer: 64 }
const layers = { water: new GeoJSONVT(water as never, opts), rivers: new GeoJSONVT(rivers as never, opts) }

rmSync(OUT, { recursive: true, force: true })
const lon2x = (lon: number, z: number) => Math.floor(((lon + 180) / 360) * 2 ** z)
const lat2y = (lat: number, z: number) => Math.floor(((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** z)
const BOUNDS: [number, number, number, number] = [-32, 26, 14, 52]
let count = 0, bytes = 0, sample: string | null = null
for (let z = MINZ; z <= MAXZ; z++) {
  for (let x = lon2x(BOUNDS[0], z); x <= lon2x(BOUNDS[2], z); x++)
    for (let y = lat2y(BOUNDS[3], z); y <= lat2y(BOUNDS[1], z); y++) {
      const tiles: Record<string, NonNullable<ReturnType<GeoJSONVT['getTile']>>> = {}
      for (const [name, idx] of Object.entries(layers)) {
        const t = idx.getTile(z, x, y)
        if (t && t.features.length) tiles[name] = t
      }
      if (!Object.keys(tiles).length) continue
      const buf = fromGeojsonVt(tiles as never, { version: 2, extent: 4096 })
      const dir = join(OUT, String(z), String(x))
      mkdirSync(dir, { recursive: true })
      writeFileSync(join(dir, `${y}.pbf`), buf)
      count++
      bytes += buf.length
      if (z === 9 && tiles.water && !sample) sample = join(dir, `${y}.pbf`)
    }
}
writeFileSync(
  join(OUT, 'tiles.json'),
  JSON.stringify({
    tilejson: '3.0.0', name: 'CatchAtlas — Atlas Ibérico', scheme: 'xyz', minzoom: MINZ, maxzoom: MAXZ, bounds: BOUNDS,
    tiles: ['{origem}/{z}/{x}/{y}.pbf'],
    vector_layers: [
      { id: 'water', fields: { id: 'String', kind: 'String', name: 'String', short: 'String', tier: 'Number', area_km2: 'Number', catalog: 'String', countries: 'String' } },
      { id: 'rivers', fields: { id: 'String', river: 'String', name: 'String', rank: 'Number', countries: 'String' } },
    ],
    attribution: '© contribuidores do OpenStreetMap (ODbL) · Natural Earth',
  }),
)
// Validação: decodifica uma amostra e confirma propriedades e geometria.
if (sample) {
  const vt = new VectorTile(new Pbf(readFileSync(sample)))
  const l = vt.layers.water
  const f = l.feature(0)
  console.log(`amostra ${sample.replace(ROOT + '/', '')}: ${l.length} elementos em "water"; 1.º: ${f.properties.name || f.properties.id} (${['', 'ponto', 'linha', 'polígono'][f.type]})`)
}
console.log(`tiles: ${count} (z${MINZ}–${MAXZ}), ${(bytes / 1024 / 1024).toFixed(1)} MB sem compressão → ${OUT.replace(ROOT + '/', '')}`)
