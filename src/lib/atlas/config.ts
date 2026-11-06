/**
 * Configuração das fontes externas do Atlas (variáveis VITE_*: são PÚBLICAS, vão no bundle).
 * Nunca colocar aqui chaves privadas. Tokens de fornecedores de tiles devem ser públicos e
 * restringidos ao domínio no painel do fornecedor. Ver .env.example e docs/ATLAS.md.
 */
import { BASEMAP_TILEJSON } from '../map/style'

const env = import.meta.env

export type DemEncoding = 'terrarium' | 'mapbox'

/** Atribuição exigida pelos Terrain Tiles (AWS Open Data / Tilezen) para a Península Ibérica. */
const TERRAIN_TILES_ATTRIBUTION =
  'Relevo: <a href="https://registry.opendata.aws/terrain-tiles/" target="_blank" rel="noopener">Terrain Tiles</a> (Tilezen/AWS Open Data) · ' +
  'EU-DEM: produzido com dados Copernicus financiados pela UE · SRTM e GMTED2010: cortesia do U.S. Geological Survey · ETOPO1: NOAA ' +
  '(<a href="https://github.com/tilezen/joerd/blob/master/docs/attribution.md" target="_blank" rel="noopener">atribuição</a>)'

export const ATLAS_CONFIG = {
  /** Mapa base vetorial (esquema OpenMapTiles). Por omissão: OpenFreeMap (gratuito, sem chave, sem SLA). */
  basemapTileJson: (env.VITE_ATLAS_BASEMAP_TILEJSON as string | undefined) || BASEMAP_TILEJSON,
  dem: {
    /** 'off' desliga o relevo (o atlas funciona em 2D sem DEM). */
    enabled: (env.VITE_ATLAS_DEM_TILES as string | undefined) !== 'off',
    tiles: (env.VITE_ATLAS_DEM_TILES as string | undefined) || 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    encoding: ((env.VITE_ATLAS_DEM_ENCODING as string | undefined) || 'terrarium') as DemEncoding,
    maxzoom: Number(env.VITE_ATLAS_DEM_MAXZOOM || 12),
    attribution: (env.VITE_ATLAS_DEM_ATTRIBUTION as string | undefined) || TERRAIN_TILES_ATTRIBUTION,
  },
}
