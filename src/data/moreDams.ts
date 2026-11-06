import type { CountryId, RegionId } from './types'

// Barragens adicionais com dados gerais: nome, rio, localidade de referência e região.
// As coordenadas são APROXIMADAS (servem apenas o mapa esquemático) e não foram
// verificadas uma a uma. Espécies, acessos e regras não são indicados nestas fichas.
export type BasicDam = [id: string, name: string, country: CountryId, region: RegionId, place: string, river: string, lat: number, lon: number]

export const MORE_DAMS: BasicDam[] = [
  // Portugal — Norte
  ['alto-lindoso', 'Alto Lindoso', 'PT', 'norte', 'Ponte da Barca', 'Rio Lima', 41.87, -8.2],
  ['touvedo', 'Touvedo', 'PT', 'norte', 'Ponte da Barca', 'Rio Lima', 41.8, -8.35],
  ['vilarinho-das-furnas', 'Vilarinho das Furnas', 'PT', 'norte', 'Terras de Bouro', 'Rio Homem', 41.77, -8.2],
  ['paradela', 'Paradela', 'PT', 'norte', 'Montalegre', 'Rio Cávado', 41.77, -7.95],
  ['alto-cavado', 'Alto Cávado', 'PT', 'norte', 'Montalegre', 'Rio Cávado', 41.8, -7.85],
  ['salamonde', 'Salamonde', 'PT', 'norte', 'Vieira do Minho', 'Rio Cávado', 41.69, -8.08],
  ['venda-nova', 'Venda Nova', 'PT', 'norte', 'Vieira do Minho · Montalegre', 'Rio Rabagão', 41.68, -7.97],
  ['torrao', 'Torrão', 'PT', 'norte', 'Marco de Canaveses', 'Rio Tâmega', 41.1, -8.25],
  ['crestuma-lever', 'Crestuma-Lever', 'PT', 'norte', 'Vila Nova de Gaia · Gondomar', 'Rio Douro', 41.07, -8.48],
  ['carrapatelo', 'Carrapatelo', 'PT', 'norte', 'Cinfães · Marco de Canaveses', 'Rio Douro', 41.09, -8.13],
  ['regua', 'Régua', 'PT', 'norte', 'Peso da Régua', 'Rio Douro', 41.14, -7.8],
  ['valeira', 'Valeira', 'PT', 'norte', 'São João da Pesqueira', 'Rio Douro', 41.16, -7.38],
  ['pocinho', 'Pocinho', 'PT', 'norte', 'Vila Nova de Foz Côa', 'Rio Douro', 41.13, -7.12],
  ['miranda', 'Miranda', 'PT', 'norte', 'Miranda do Douro', 'Rio Douro', 41.49, -6.27],
  ['picote', 'Picote', 'PT', 'norte', 'Miranda do Douro', 'Rio Douro', 41.4, -6.36],
  ['bemposta', 'Bemposta', 'PT', 'norte', 'Mogadouro', 'Rio Douro', 41.3, -6.47],
  ['azibo', 'Azibo', 'PT', 'norte', 'Macedo de Cavaleiros', 'Rio Azibo', 41.57, -6.9],
  ['vilar', 'Vilar', 'PT', 'norte', 'Moimenta da Beira · Sernancelhe', 'Rio Távora', 40.95, -7.6],
  ['varosa', 'Varosa', 'PT', 'norte', 'Lamego', 'Rio Varosa', 41.08, -7.8],
  // Portugal — Centro
  ['fronhas', 'Fronhas', 'PT', 'centro', 'Arganil · Penacova', 'Rio Alva', 40.21, -8.15],
  ['raiva', 'Raiva', 'PT', 'centro', 'Penacova', 'Rio Mondego', 40.3, -8.22],
  ['caldeirao', 'Caldeirão', 'PT', 'centro', 'Guarda', 'Rio Caldeirão', 40.52, -7.3],
  ['sabugal', 'Sabugal', 'PT', 'centro', 'Sabugal', 'Rio Côa', 40.38, -7.08],
  ['santa-luzia', 'Santa Luzia', 'PT', 'centro', 'Pampilhosa da Serra', 'Rio Unhais', 40.1, -7.88],
  ['meimoa', 'Meimoa', 'PT', 'centro', 'Penamacor', 'Ribeira da Meimoa', 40.22, -7.15],
  ['marateca', 'Marateca (Santa Águeda)', 'PT', 'centro', 'Castelo Branco', 'Rio Ocreza', 39.95, -7.55],
  ['pracana', 'Pracana', 'PT', 'centro', 'Mação', 'Rio Ocreza', 39.56, -7.82],
  ['fratel', 'Fratel', 'PT', 'centro', 'Vila Velha de Ródão · Nisa', 'Rio Tejo', 39.55, -7.8],
  ['belver', 'Belver', 'PT', 'centro', 'Gavião · Mação', 'Rio Tejo', 39.48, -7.99],
  // Portugal — Lisboa e Vale do Tejo
  ['magos', 'Magos', 'PT', 'lisboa', 'Salvaterra de Magos', 'Ribeira de Magos', 39.04, -8.69],
  ['sao-domingos', 'São Domingos', 'PT', 'lisboa', 'Peniche', 'Rio São Domingos', 39.33, -9.33],
  // Portugal — Alentejo
  ['povoa-e-meadas', 'Póvoa e Meadas', 'PT', 'alentejo', 'Castelo de Vide', 'Ribeira de Nisa', 39.43, -7.53],
  ['apartadura', 'Apartadura', 'PT', 'alentejo', 'Marvão', 'Ribeira da Apartadura', 39.35, -7.33],
  ['lucefecit', 'Lucefécit', 'PT', 'alentejo', 'Alandroal', 'Ribeira de Lucefécit', 38.62, -7.32],
  ['vigia', 'Vigia', 'PT', 'alentejo', 'Redondo', 'Ribeira do Vale de Vasco', 38.52, -7.47],
  ['divor', 'Divor', 'PT', 'alentejo', 'Arraiolos', 'Ribeira do Divor', 38.73, -8.05],
  ['monte-novo', 'Monte Novo', 'PT', 'alentejo', 'Évora', 'Rio Degebe', 38.53, -7.73],
  ['alvito', 'Alvito', 'PT', 'alentejo', 'Alvito', 'Ribeira de Odivelas', 38.27, -7.97],
  ['odivelas', 'Odivelas', 'PT', 'alentejo', 'Ferreira do Alentejo', 'Ribeira de Odivelas', 38.17, -8.1],
  ['vale-do-gaio', 'Vale do Gaio', 'PT', 'alentejo', 'Alcácer do Sal', 'Rio Xarrama', 38.25, -8.32],
  ['campilhas', 'Campilhas', 'PT', 'alentejo', 'Santiago do Cacém', 'Ribeira de Campilhas', 37.97, -8.55],
  ['monte-da-rocha', 'Monte da Rocha', 'PT', 'alentejo', 'Ourique', 'Rio Sado', 37.73, -8.27],
  ['pedrogao', 'Pedrógão', 'PT', 'alentejo', 'Vidigueira · Moura', 'Rio Guadiana', 38.12, -7.64],
  ['enxoe', 'Enxoé', 'PT', 'alentejo', 'Serpa', 'Ribeira de Enxoé', 37.98, -7.43],
  ['chanca', 'Chança', 'PT', 'alentejo', 'Mértola (fronteira)', 'Rio Chança', 37.62, -7.5],
  ['misericordia', 'Misericórdia', 'PT', 'alentejo', 'Beja', 'Linha de água não confirmada', 37.98, -7.85],
  ['foro-do-espanhol', 'Foro do Espanhol', 'PT', 'alentejo', 'Alandroal', 'Linha de água não confirmada', 38.65, -7.4],
  // Portugal — Algarve
  ['beliche', 'Beliche', 'PT', 'algarve', 'Castro Marim', 'Ribeira de Beliche', 37.28, -7.56],
  ['bravura', 'Bravura', 'PT', 'algarve', 'Lagos · Monchique', 'Ribeira de Odiáxere', 37.2, -8.7],
  ['arade', 'Arade', 'PT', 'algarve', 'Silves', 'Rio Arade', 37.23, -8.37],
  ['funcho', 'Funcho', 'PT', 'algarve', 'Silves', 'Rio Arade', 37.23, -8.4],
  ['odelouca', 'Odelouca', 'PT', 'algarve', 'Silves · Monchique', 'Ribeira de Odelouca', 37.26, -8.48],
  // Espanha — Estremadura
  ['cijara', 'Cíjara', 'ES', 'extremadura', 'Badajoz · Ciudad Real', 'Rio Guadiana', 39.38, -4.85],
  ['garcia-de-sola', 'García de Sola', 'ES', 'extremadura', 'Badajoz', 'Rio Guadiana', 39.15, -5.18],
  ['alange', 'Alange', 'ES', 'extremadura', 'Badajoz', 'Rio Matachel', 38.78, -6.24],
  ['gabriel-y-galan', 'Gabriel y Galán', 'ES', 'extremadura', 'Cáceres', 'Rio Alagón', 40.25, -6.15],
  ['borbollon', 'Borbollón', 'ES', 'extremadura', 'Cáceres', 'Rio Árrago', 40.16, -6.57],
  ['sierra-brava', 'Sierra Brava', 'ES', 'extremadura', 'Zorita · Cáceres', 'Arroyo Pizarroso', 39.25, -5.66],
  // Espanha — Castela-La Mancha e Madrid
  ['entrepenas', 'Entrepeñas', 'ES', 'castela-mancha', 'Guadalajara', 'Rio Tejo', 40.55, -2.65],
  ['alarcon', 'Alarcón', 'ES', 'castela-mancha', 'Cuenca', 'Rio Júcar', 39.55, -2.08],
  ['contreras', 'Contreras', 'ES', 'castela-mancha', 'Cuenca · Valência', 'Rio Cabriel', 39.57, -1.5],
  ['el-atazar', 'El Atazar', 'ES', 'castela-mancha', 'Madrid', 'Rio Lozoya', 40.92, -3.52],
  ['pinilla', 'Pinilla', 'ES', 'castela-mancha', 'Madrid', 'Rio Lozoya', 40.92, -3.82],
  ['san-juan', 'San Juan', 'ES', 'castela-mancha', 'Madrid', 'Rio Alberche', 40.38, -4.33],
  ['valmayor', 'Valmayor', 'ES', 'castela-mancha', 'Madrid', 'Rio Aulencia', 40.53, -4.03],
  // Espanha — Castela e Leão
  ['almendra', 'Almendra', 'ES', 'castela-leao', 'Salamanca · Zamora', 'Rio Tormes', 41.2, -6.25],
  ['santa-teresa', 'Santa Teresa', 'ES', 'castela-leao', 'Salamanca', 'Rio Tormes', 40.6, -5.6],
  ['aldeadavila', 'Aldeadávila', 'ES', 'castela-leao', 'Salamanca', 'Rio Douro', 41.21, -6.68],
  ['barrios-de-luna', 'Barrios de Luna', 'ES', 'castela-leao', 'León', 'Rio Luna', 42.85, -5.85],
  ['riano', 'Riaño', 'ES', 'castela-leao', 'León', 'Rio Esla', 42.97, -5.0],
  ['cuerda-del-pozo', 'Cuerda del Pozo', 'ES', 'castela-leao', 'Soria', 'Rio Douro', 41.88, -2.73],
  // Espanha — Galiza
  ['belesar', 'Belesar', 'ES', 'galiza', 'Lugo', 'Rio Minho', 42.63, -7.7],
  // Espanha — Aragão e Catalunha
  ['ribarroja', 'Riba-roja', 'ES', 'catalunha', 'Tarragona', 'Rio Ebro', 41.25, 0.48],
  ['yesa', 'Yesa', 'ES', 'aragao', 'Navarra · Saragoça', 'Rio Aragón', 42.62, -1.17],
  ['mediano', 'Mediano', 'ES', 'aragao', 'Huesca', 'Rio Cinca', 42.33, 0.18],
  ['el-grado', 'El Grado', 'ES', 'aragao', 'Huesca', 'Rio Cinca', 42.15, 0.23],
  ['santa-ana', 'Santa Ana', 'ES', 'aragao', 'Huesca · Lleida', 'Rio Noguera Ribagorzana', 41.88, 0.48],
  ['canelles', 'Canelles', 'ES', 'catalunha', 'Lleida · Huesca', 'Rio Noguera Ribagorzana', 42.0, 0.65],
  ['sau', 'Sau', 'ES', 'catalunha', 'Barcelona', 'Rio Ter', 41.98, 2.38],
  // Espanha — Andaluzia
  ['guadalcacin', 'Guadalcacín', 'ES', 'andaluzia', 'Cádis', 'Rio Majaceite', 36.7, -5.7],
  ['negratin', 'Negratín', 'ES', 'andaluzia', 'Granada', 'Rio Guadiana Menor', 37.57, -2.95],
  ['tranco-de-beas', 'Tranco de Beas', 'ES', 'andaluzia', 'Jaén', 'Rio Guadalquivir', 38.15, -2.8],
  ['andevalo', 'Andévalo', 'ES', 'andaluzia', 'Huelva', 'Rio Malagón', 37.55, -7.2],
  ['brena-ii', 'Breña II', 'ES', 'andaluzia', 'Córdoba', 'Rio Guadiato', 37.8, -5.05],
]
