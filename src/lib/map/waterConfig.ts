/**
 * Política de visibilidade das massas de água do mapa (centralizada aqui).
 *
 * As albufeiras são classificadas pela ÁREA SUPERFICIAL GEODÉSICA do contorno completo
 * (calculada no build, nunca a partir da parte visível nem dos tiles) e não pela capacidade.
 *
 * Os limiares de zoom são RELATIVOS ao enquadramento da Península (`fitZoom`), calculado em
 * tempo real para o tamanho do mapa. Assim, "Península inteira", "País", "Região"… mostram a
 * mesma hierarquia num telemóvel (fitZoom medido ≈ 4,1), num tablet (≈ 5,3) e num computador (≈ 5,0), em vez de
 * dependerem de um nível de zoom absoluto.
 *
 * Calibração (dados: 3 137 albufeiras ≥ 5 ha de Portugal e Espanha, OSM 2026-11-02):
 *  - ≥ 40 km²: 11 albufeiras (Alqueva 224, La Serena 130, Alcántara 87, Almendra 82…).
 *    São as únicas visíveis na Península inteira: chegam para mostrar a distribuição sem ruído.
 *  - 15–40 km²: 33 (Castelo do Bode, Baixo Sabor, Gabriel y Galán…). Aparecem à escala de país.
 *  - 3–15 km²: 171. Escala regional.
 *  - 0,5–3 km²: 307. Zona local.
 *  - 0,05–0,5 km²: 2 615. Aproximação elevada.
 * À escala de cada escalão, o menor polígono do escalão ocupa pelo menos ~15–40 px² no ecrã,
 * o suficiente para se distinguir sem ser ampliado artificialmente.
 */

export type Tier = 1 | 2 | 3 | 4 | 5

/** Escalões por área superficial mínima (km²). */
export const AREA_TIERS: { tier: Tier; minKm2: number; label: string; scale: string }[] = [
  { tier: 1, minKm2: 40, label: 'Grande', scale: 'Península inteira' },
  { tier: 2, minKm2: 15, label: 'Intermédia', scale: 'País ou grandes regiões' },
  { tier: 3, minKm2: 3, label: 'Pequena', scale: 'Região' },
  { tier: 4, minKm2: 0.5, label: 'Muito pequena', scale: 'Zona local' },
  { tier: 5, minKm2: 0, label: 'Mínima', scale: 'Aproximação elevada' },
]

export const tierForArea = (km2: number): Tier => (AREA_TIERS.find((t) => km2 >= t.minKm2)?.tier ?? 5)

/** Zoom (relativo a fitZoom) a partir do qual cada escalão começa a aparecer (com fade de FADE). */
export const TIER_ZOOM_OFFSET: Record<Tier, number> = { 1: -4, 2: 0.8, 3: 1.8, 4: 3.0, 5: 4.2 }
/**
 * Os rótulos aparecem logo a seguir ao polígono (+0,1 a +0,2). A deteção de colisões do MapLibre
 * escolhe os que cabem, dando prioridade às maiores albufeiras, por isso não há sobreposições.
 */
export const LABEL_ZOOM_OFFSET: Record<Tier, number> = { 1: -0.2, 2: 0.9, 3: 2.0, 4: 3.1, 5: 4.3 }
/** Duração (em níveis de zoom) do fade de opacidade. Evita aparecimentos bruscos e cintilação. */
export const FADE = 0.4

/** Escalões incluídos no ficheiro de visão geral (carregado na abertura). */
export const OVERVIEW_MAX_TIER: Tier = 2
/** A partir daqui a visão geral (simplificada) dá lugar aos blocos de detalhe. */
export const DETAIL_FROM_OFFSET = 2.4
/** Os blocos de detalhe começam a ser pedidos um pouco antes, pela área visível. */
export const DETAIL_PREFETCH_OFFSET = 1.4
/**
 * Água do mapa base (lagos, lagoas e albufeiras < 5 ha do OpenStreetMap): escondida até à
 * escala local, para que a vista inicial não mostre todas as pequenas massas de água.
 */
export const BASEMAP_WATER_OFFSET = 3.2
/** Rios: principais à escala regional, secundários mais tarde. */
export const RIVER_OFFSET = { major: 1.2, minor: 3.4, streams: 5.2 }
/** Pontos das barragens do catálogo (infraestrutura): só em níveis de detalhe. */
export const DAM_POINT_OFFSET = 2.6
/**
 * Estruturas do OSM (barragens e açudes). Medem dezenas a centenas de metros: primeiro aparecem como
 * ponto discreto (barragens à escala local, açudes um pouco depois) e, quando já se distinguem, com a
 * forma real (linha ou polígono). Os blocos só são pedidos a partir de STRUCTURE_PREFETCH_OFFSET.
 */
export const STRUCTURE_OFFSET = { prefetch: 3.0, damPoint: 3.4, damLabel: 3.9, weirPoint: 4.2, weirLabel: 5.0, shape: 5.4 }
/** Nomes da água do mapa base (lagos e lagoas fora das albufeiras da CatchAtlas), à escala local. */
export const BASEMAP_WATER_NAME_OFFSET = 3.8
/** Concessões e zonas de pesca: marca a partir da escala de país/região; contorno tracejado com o detalhe. */
export const ZONE_OFFSET = { badge: 1.2, badgeLabel: 1.9, outline: 2.4 }

/** Limites usados para o enquadramento "Península" e "Portugal" ([oeste, sul, este, norte]). */
export const IBERIA_BOUNDS: [number, number, number, number] = [-9.6, 35.95, 3.4, 43.85]
export const PORTUGAL_BOUNDS: [number, number, number, number] = [-9.6, 36.9, -6.1, 42.2]
/** O mapa não deixa sair demasiado da região coberta pelos dados. */
export const MAX_BOUNDS: [number, number, number, number] = [-20, 26, 14, 52]
