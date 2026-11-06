/**
 * Rios do Atlas (vista geral): tabela explícita de nomes, usada por `npm run atlas:build`.
 *
 * A geometria vem do Natural Earth 10 m (rios + suplemento europeu). Esta tabela:
 *  - junta os troços que a fonte nomeia de forma diferente em cada país (Tajo/Tejo, Duero/Douro…);
 *  - corrige nomes que chegam corrompidos na fonte ("Mio" → Miño, "Zncara" → Záncara);
 *  - acrescenta os nomes alternativos usados na pesquisa;
 *  - indica a bacia (hidrografia geral; não substitui os limites oficiais das demarcações).
 * Rios franceses do recorte (Garonne, Adour…) ficam fora: o atlas é ibérico.
 */
export interface AtlasRiverName {
  id: string
  /** Nome mostrado (português; transfronteiriços com os dois nomes). */
  name: string
  alt: string[]
  /** Nomes exatos (campo `name`) das linhas do Natural Earth que pertencem a este rio. */
  ne: string[]
  /** 1: visível na Península inteira; 2: escala regional; 3: escala local. */
  rank: 1 | 2 | 3
  basin: string
  /** Rio da app (`src/data/rivers.ts`), quando existe. */
  appRiver?: string
}

export const ATLAS_RIVERS: AtlasRiverName[] = [
  { id: 'tejo', name: 'Tejo / Tajo', alt: ['Tejo', 'Tajo', 'Rio Tejo', 'Río Tajo'], ne: ['Tajo', 'Tejo'], rank: 1, basin: 'Tejo', appRiver: 'tejo' },
  { id: 'douro', name: 'Douro / Duero', alt: ['Douro', 'Duero', 'Rio Douro', 'Río Duero'], ne: ['Duero'], rank: 1, basin: 'Douro', appRiver: 'douro' },
  { id: 'guadiana', name: 'Guadiana', alt: ['Rio Guadiana', 'Río Guadiana'], ne: ['Guadiana'], rank: 1, basin: 'Guadiana', appRiver: 'guadiana' },
  { id: 'ebro', name: 'Ebro', alt: ['Ebre', 'Río Ebro'], ne: ['Ebro'], rank: 1, basin: 'Ebro', appRiver: 'ebro' },
  { id: 'guadalquivir', name: 'Guadalquivir', alt: ['Río Guadalquivir'], ne: ['Guadalquivir'], rank: 1, basin: 'Guadalquivir', appRiver: 'guadalquivir' },
  { id: 'minho', name: 'Minho / Miño', alt: ['Minho', 'Miño', 'Rio Minho', 'Río Miño'], ne: ['Minho', 'Mio'], rank: 1, basin: 'Minho', appRiver: 'minho' },
  { id: 'jucar', name: 'Júcar', alt: ['Xúquer', 'Río Júcar'], ne: ['Júcar'], rank: 2, basin: 'Júcar', appRiver: 'jucar' },
  { id: 'segura', name: 'Segura', alt: ['Río Segura'], ne: ['Segura'], rank: 2, basin: 'Segura' },
  { id: 'mondego', name: 'Mondego', alt: ['Rio Mondego'], ne: ['Mondego'], rank: 2, basin: 'Mondego', appRiver: 'mondego' },
  { id: 'sado', name: 'Sado', alt: ['Rio Sado'], ne: ['Sado'], rank: 2, basin: 'Sado', appRiver: 'sado' },
  { id: 'zezere', name: 'Zêzere', alt: ['Rio Zêzere', 'Zezere'], ne: ['Zêzere'], rank: 2, basin: 'Tejo', appRiver: 'tejo' },
  { id: 'sorraia', name: 'Sorraia', alt: ['Rio Sorraia'], ne: ['Sorraia'], rank: 3, basin: 'Tejo', appRiver: 'tejo' },
  { id: 'alagon', name: 'Alagón', alt: ['Rio Alagón', 'Río Alagón'], ne: ['Alagón'], rank: 2, basin: 'Tejo', appRiver: 'tejo' },
  { id: 'tietar', name: 'Tiétar', alt: ['Río Tiétar'], ne: ['Tiétar'], rank: 3, basin: 'Tejo', appRiver: 'tejo' },
  { id: 'alberche', name: 'Alberche', alt: ['Río Alberche'], ne: ['Alberche'], rank: 3, basin: 'Tejo', appRiver: 'tejo' },
  { id: 'henares', name: 'Henares', alt: ['Río Henares'], ne: ['Henares'], rank: 3, basin: 'Tejo' },
  { id: 'esla', name: 'Esla', alt: ['Río Esla'], ne: ['Esla'], rank: 2, basin: 'Douro', appRiver: 'douro' },
  { id: 'tormes', name: 'Tormes', alt: ['Río Tormes'], ne: ['Tormes'], rank: 3, basin: 'Douro', appRiver: 'douro' },
  { id: 'pisuerga', name: 'Pisuerga', alt: ['Río Pisuerga'], ne: ['Pisuerga'], rank: 3, basin: 'Douro' },
  { id: 'adaja', name: 'Adaja', alt: ['Río Adaja'], ne: ['Adaja'], rank: 3, basin: 'Douro' },
  { id: 'luna', name: 'Luna', alt: ['Río Luna'], ne: ['Luna'], rank: 3, basin: 'Douro', appRiver: 'douro' },
  { id: 'sil', name: 'Sil', alt: ['Río Sil'], ne: ['Sil'], rank: 2, basin: 'Minho' },
  { id: 'narcea', name: 'Narcea', alt: ['Río Narcea'], ne: ['Narcea'], rank: 3, basin: 'Nalón' },
  { id: 'zujar', name: 'Zújar', alt: ['Río Zújar'], ne: ['Zújar'], rank: 3, basin: 'Guadiana', appRiver: 'guadiana' },
  { id: 'zancara', name: 'Záncara', alt: ['Río Záncara', 'Zancara'], ne: ['Zncara'], rank: 3, basin: 'Guadiana' },
  { id: 'genil', name: 'Genil', alt: ['Río Genil'], ne: ['Genil'], rank: 2, basin: 'Guadalquivir', appRiver: 'guadalquivir' },
  { id: 'guadalimar', name: 'Guadalimar', alt: ['Río Guadalimar'], ne: ['Guadalimar'], rank: 3, basin: 'Guadalquivir' },
  { id: 'guadiana-menor', name: 'Guadiana Menor', alt: ['Río Guadiana Menor'], ne: ['Guadiana Menor'], rank: 3, basin: 'Guadalquivir', appRiver: 'guadalquivir' },
  { id: 'segre', name: 'Segre', alt: ['Río Segre', 'Riu Segre'], ne: ['Segre'], rank: 2, basin: 'Ebro' },
  { id: 'cinca', name: 'Cinca', alt: ['Río Cinca'], ne: ['Cinca'], rank: 3, basin: 'Ebro', appRiver: 'ebro' },
  { id: 'jalon', name: 'Jalón', alt: ['Río Jalón'], ne: ['Jalón'], rank: 3, basin: 'Ebro' },
  { id: 'jiloca', name: 'Jiloca', alt: ['Río Jiloca'], ne: ['Jiloca'], rank: 3, basin: 'Ebro' },
  { id: 'cabriel', name: 'Cabriel', alt: ['Río Cabriel'], ne: ['Cabriel'], rank: 3, basin: 'Júcar', appRiver: 'jucar' },
  { id: 'turia', name: 'Túria', alt: ['Turia', 'Río Turia'], ne: ['Turia'], rank: 3, basin: 'Túria' },
  { id: 'mijares', name: 'Mijares', alt: ['Millars', 'Río Mijares'], ne: ['Mijares'], rank: 3, basin: 'Mijares' },
  { id: 'cardener', name: 'Cardener', alt: ['Cardoner', 'Riu Cardener'], ne: ['Cardoner'], rank: 3, basin: 'Llobregat' },
]
