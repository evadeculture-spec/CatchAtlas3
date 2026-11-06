import { MORE_DAMS } from './moreDams'
import type { ArtPalette, Dam, ModalityId, RegionId, SpeciesId } from './types'

// Nomes, região, localidade e rio são informação geral. Tudo o resto é ilustrativo:
// espécies "de exemplo", características e condições NÃO estão verificadas.
// As coordenadas são aproximadas e servem apenas o mapa esquemático.
const PT_CORE: Dam[] = [
  {
    id: 'alqueva',
    name: 'Alqueva',
    country: 'PT',
    region: 'alentejo',
    place: 'Moura · Portel · Reguengos',
    river: 'Rio Guadiana',
    approx: { lat: 38.25, lon: -7.45 },
    species: ['achiga', 'carpa', 'lucioperca', 'barbo', 'siluro'],
    modalities: ['margem', 'caiaque', 'embarcacao'],
    summary:
      'Grande plano de água com braços extensos, ilhas e enseadas. Na demonstração serve de exemplo para jornadas longas, de margem ou embarcadas.',
    traits: [
      { label: 'Escala', value: 'Muito extensa' },
      { label: 'Margens', value: 'Mistas, com enseadas' },
      { label: 'Ambiente', value: 'Planície, montado' },
    ],
    art: { seed: 11, sky: ['#F6D9A8', '#9FC9D6'], hills: ['#A9B38A', '#7F9170', '#5D735B'], water: ['#5C9DAE', '#1D4A5C'], sun: 'low', trees: true },
  },
  {
    id: 'castelo-de-bode',
    name: 'Castelo de Bode',
    country: 'PT',
    region: 'centro',
    place: 'Tomar · Abrantes',
    river: 'Rio Zêzere',
    approx: { lat: 39.55, lon: -8.32 },
    species: ['achiga', 'carpa', 'lucio', 'barbo'],
    modalities: ['margem', 'caiaque', 'embarcacao'],
    summary:
      'Albufeira encaixada entre encostas arborizadas, com muitas reentrâncias. Usada na demonstração para ilustrar pesca em estruturas e ravinas.',
    traits: [
      { label: 'Escala', value: 'Extensa' },
      { label: 'Margens', value: 'Íngremes, arborizadas' },
      { label: 'Ambiente', value: 'Vale encaixado' },
    ],
    art: { seed: 23, sky: ['#E8EEE9', '#A7C7CF'], hills: ['#6E8F78', '#4F7360', '#33574A'], water: ['#3F8C93', '#123B48'], sun: 'none', mist: true, trees: true },
  },
  {
    id: 'cabril',
    name: 'Cabril',
    country: 'PT',
    region: 'centro',
    place: 'Pedrógão Grande · Sertã',
    river: 'Rio Zêzere',
    approx: { lat: 39.93, lon: -8.13 },
    species: ['achiga', 'carpa', 'barbo'],
    modalities: ['margem', 'caiaque', 'embarcacao'],
    summary:
      'Paisagem de montanha com encostas acentuadas e águas profundas junto às margens. Exemplo de jornada de técnica e paciência.',
    traits: [
      { label: 'Escala', value: 'Média' },
      { label: 'Margens', value: 'Rochosas, declive forte' },
      { label: 'Ambiente', value: 'Montanha, xisto' },
    ],
    art: { seed: 37, sky: ['#DCE6EC', '#8DB3C4'], hills: ['#7D8C86', '#5A6F6A', '#3B5250'], water: ['#2F7F8A', '#0E3341'], sun: 'high', trees: true },
  },
  {
    id: 'bouca',
    name: 'Bouçã',
    country: 'PT',
    region: 'centro',
    place: 'Pedrógão Grande · Figueiró dos Vinhos',
    river: 'Rio Zêzere',
    approx: { lat: 39.86, lon: -8.22 },
    species: ['achiga', 'barbo', 'carpa'],
    modalities: ['margem', 'caiaque'],
    summary:
      'Plano de água mais estreito, em vale sinuoso. Na demonstração surge como opção tranquila para caiaque e margem.',
    traits: [
      { label: 'Escala', value: 'Pequena a média' },
      { label: 'Margens', value: 'Sinuosas' },
      { label: 'Ambiente', value: 'Vale fluvial' },
    ],
    art: { seed: 41, sky: ['#F1E4CF', '#B5CFD2'], hills: ['#8FA38A', '#668167', '#45604C'], water: ['#4C9599', '#164651'], sun: 'low', mist: true, trees: true },
  },
  {
    id: 'montargil',
    name: 'Montargil',
    country: 'PT',
    region: 'alentejo',
    place: 'Ponte de Sor',
    river: 'Ribeira de Sor',
    approx: { lat: 39.05, lon: -8.17 },
    species: ['achiga', 'carpa', 'lucioperca', 'barbo'],
    modalities: ['margem', 'caiaque', 'embarcacao'],
    summary:
      'Albufeira aberta, de margens suaves e envolvida por montado. Exemplo de jornadas de margem e de provas na demonstração.',
    traits: [
      { label: 'Escala', value: 'Média a extensa' },
      { label: 'Margens', value: 'Suaves, acessíveis' },
      { label: 'Ambiente', value: 'Montado, planície' },
    ],
    art: { seed: 53, sky: ['#F7E2BD', '#A9CCD3'], hills: ['#B5B58E', '#8E9974', '#6A7D5E'], water: ['#68A5AE', '#1F5262'], sun: 'low', trees: true },
  },
  {
    id: 'maranhao',
    name: 'Maranhão',
    country: 'PT',
    region: 'alentejo',
    place: 'Avis',
    river: 'Ribeira de Seda',
    approx: { lat: 39.02, lon: -7.93 },
    species: ['achiga', 'carpa', 'lucioperca'],
    modalities: ['margem', 'embarcacao'],
    summary:
      'Plano de água com longos braços e pontas de terra. Na demonstração ilustra jornadas de embarcação em zonas abertas.',
    traits: [
      { label: 'Escala', value: 'Extensa' },
      { label: 'Margens', value: 'Abertas, com pontões' },
      { label: 'Ambiente', value: 'Planície alentejana' },
    ],
    art: { seed: 67, sky: ['#EFD3B0', '#93BCCB'], hills: ['#ABA987', '#87906F', '#5F7058'], water: ['#5B98A7', '#18465A'], sun: 'high' },
  },
  {
    id: 'santa-clara',
    name: 'Santa Clara',
    country: 'PT',
    region: 'alentejo',
    place: 'Odemira',
    river: 'Rio Mira',
    approx: { lat: 37.52, lon: -8.43 },
    species: ['achiga', 'carpa', 'barbo'],
    modalities: ['margem', 'caiaque', 'embarcacao'],
    summary:
      'Albufeira recortada entre serras baixas, com muitas pequenas baías. Exemplo de exploração de estruturas a partir de caiaque.',
    traits: [
      { label: 'Escala', value: 'Extensa' },
      { label: 'Margens', value: 'Recortadas, com baías' },
      { label: 'Ambiente', value: 'Serra baixa' },
    ],
    art: { seed: 79, sky: ['#F3DDC4', '#A2C3CF'], hills: ['#93A07F', '#6F8466', '#4D6650'], water: ['#4E95A0', '#123F4F'], sun: 'low', mist: true, trees: true },
  },
  {
    id: 'aguieira',
    name: 'Aguieira',
    country: 'PT',
    region: 'centro',
    place: 'Penacova · Mortágua',
    river: 'Rio Mondego',
    approx: { lat: 40.34, lon: -8.2 },
    species: ['achiga', 'carpa', 'lucio', 'barbo'],
    modalities: ['margem', 'caiaque', 'embarcacao'],
    summary:
      'Albufeira ramificada, com vales arborizados e muitas margens. Na demonstração representa jornadas mistas ao longo do ano.',
    traits: [
      { label: 'Escala', value: 'Extensa' },
      { label: 'Margens', value: 'Arborizadas, variadas' },
      { label: 'Ambiente', value: 'Vales e floresta' },
    ],
    art: { seed: 89, sky: ['#E5ECEA', '#9DBFCB'], hills: ['#7E9A80', '#5C7E66', '#3D5F4E'], water: ['#3D8A92', '#0F3946'], sun: 'none', mist: true, trees: true },
  },
]

// Paletas base para as ilustrações das barragens adicionais.
const PRESETS: Record<'planicie' | 'vale' | 'montanha' | 'serra', Omit<ArtPalette, 'seed'>> = {
  planicie: { sky: ['#F5DDB6', '#A3C7D1'], hills: ['#B3B28C', '#8D9873', '#677B5C'], water: ['#62A0AC', '#1C4D5E'], sun: 'low', trees: true },
  vale: { sky: ['#E6EDEA', '#A1C3CD'], hills: ['#76957D', '#56796A', '#38594C'], water: ['#3E8B92', '#113A47'], sun: 'none', mist: true, trees: true },
  montanha: { sky: ['#DCE5EB', '#8BB0C2'], hills: ['#808E89', '#5D716C', '#3C5351'], water: ['#2E7E89', '#0E3340'], sun: 'high', trees: true },
  serra: { sky: ['#F1DFC8', '#A6C4CF'], hills: ['#97A381', '#728768', '#506851'], water: ['#4F95A0', '#13404F'], sun: 'low', mist: true, trees: true },
}

type Extra = [
  id: string,
  name: string,
  country: 'PT' | 'ES',
  region: RegionId,
  place: string,
  river: string,
  lat: number,
  lon: number,
  species: SpeciesId[],
  modalities: ModalityId[],
  preset: keyof typeof PRESETS,
  summary: string,
  traits: [string, string, string],
]

// Barragens adicionais (Portugal e Espanha). Mesmas regras: nome, local e rio são
// informação geral; o resto é ilustrativo e não verificado.
const EXTRA: Extra[] = [
  ['alto-rabagao', 'Alto Rabagão', 'PT', 'norte', 'Montalegre', 'Rio Rabagão', 41.74, -7.86, ['achiga', 'carpa', 'barbo'], ['margem', 'caiaque', 'embarcacao'], 'montanha', 'Planalto de altitude, aberto e exposto ao vento. Exemplo de jornadas de margem em zona fresca.', ['Muito extensa', 'Abertas, de planalto', 'Montanha, granito']],
  ['canicada', 'Caniçada', 'PT', 'norte', 'Vieira do Minho · Terras de Bouro', 'Rio Cávado', 41.68, -8.15, ['achiga', 'carpa', 'lucio', 'barbo'], ['margem', 'caiaque', 'embarcacao'], 'vale', 'Albufeira entre serras arborizadas, junto ao Gerês. Exemplo de pesca em ravinas e margens sombreadas.', ['Média', 'Íngremes, arborizadas', 'Serra, floresta']],
  ['baixo-sabor', 'Baixo Sabor', 'PT', 'norte', 'Torre de Moncorvo', 'Rio Sabor', 41.22, -7.0, ['achiga', 'carpa', 'barbo'], ['margem', 'caiaque', 'embarcacao'], 'serra', 'Vale encaixado no Nordeste transmontano, com muitas reentrâncias. Exemplo de jornadas embarcadas.', ['Extensa', 'Recortadas, rochosas', 'Vale encaixado']],
  ['idanha', 'Idanha', 'PT', 'centro', 'Idanha-a-Nova', 'Rio Ponsul', 39.95, -7.18, ['achiga', 'carpa', 'lucioperca', 'barbo'], ['margem', 'caiaque', 'embarcacao'], 'planicie', 'Albufeira da Beira Baixa, com margens abertas. Exemplo de jornadas tranquilas de margem.', ['Média', 'Abertas, suaves', 'Campo, montado']],
  ['caia', 'Caia', 'PT', 'alentejo', 'Elvas · Campo Maior', 'Rio Caia', 38.98, -7.12, ['achiga', 'carpa', 'lucioperca'], ['margem', 'embarcacao'], 'planicie', 'Plano de água junto à fronteira, em planície. Exemplo de pesca em zonas abertas.', ['Média a extensa', 'Abertas', 'Planície alentejana']],
  ['pego-do-altar', 'Pego do Altar', 'PT', 'alentejo', 'Alcácer do Sal', 'Ribeira de Santa Catarina de Sítimos', 38.43, -8.4, ['achiga', 'carpa', 'barbo'], ['margem', 'caiaque'], 'planicie', 'Albufeira rodeada de montado, com braços estreitos. Exemplo de exploração a partir de caiaque.', ['Média', 'Mistas, com braços', 'Montado']],
  ['roxo', 'Roxo', 'PT', 'alentejo', 'Aljustrel · Beja', 'Ribeira do Roxo', 37.93, -8.1, ['achiga', 'carpa', 'lucioperca'], ['margem', 'caiaque', 'embarcacao'], 'planicie', 'Albufeira do Baixo Alentejo, de margens suaves. Exemplo de jornadas de margem no sul.', ['Média', 'Suaves', 'Planície']],
  ['odeleite', 'Odeleite', 'PT', 'algarve', 'Castro Marim', 'Ribeira de Odeleite', 37.33, -7.5, ['achiga', 'carpa', 'barbo'], ['margem', 'caiaque'], 'serra', 'Albufeira serrana do Algarve, recortada e sinuosa. Exemplo de pesca em baías abrigadas.', ['Média', 'Recortadas', 'Serra algarvia']],
  ['alcantara', 'Alcántara', 'ES', 'extremadura', 'Alcántara · Cáceres', 'Rio Tejo', 39.72, -6.75, ['achiga', 'carpa', 'lucioperca', 'siluro'], ['margem', 'caiaque', 'embarcacao'], 'planicie', 'Grande albufeira do Tejo espanhol, com longos braços. Exemplo de jornadas embarcadas de vários dias.', ['Muito extensa', 'Mistas, com braços', 'Dehesa, planície']],
  ['valdecanas', 'Valdecañas', 'ES', 'extremadura', 'Cáceres', 'Rio Tejo', 39.8, -5.5, ['achiga', 'carpa', 'lucioperca', 'siluro'], ['margem', 'embarcacao'], 'planicie', 'Albufeira extensa do Tejo, em zona de dehesa. Exemplo de pesca de predadores em zonas abertas.', ['Extensa', 'Abertas', 'Dehesa']],
  ['orellana', 'Orellana', 'ES', 'extremadura', 'Orellana la Vieja · Badajoz', 'Rio Guadiana', 39.0, -5.45, ['achiga', 'carpa', 'lucioperca'], ['margem', 'caiaque', 'embarcacao'], 'planicie', 'Albufeira do Guadiana com praias e margens suaves. Exemplo de jornadas mistas.', ['Extensa', 'Suaves', 'Planície']],
  ['la-serena', 'La Serena', 'ES', 'extremadura', 'Castuera · Badajoz', 'Rio Zújar', 38.9, -5.2, ['achiga', 'carpa', 'lucioperca', 'barbo'], ['margem', 'embarcacao'], 'planicie', 'Grande plano de água em planície aberta. Exemplo de jornadas de procura em grandes áreas.', ['Muito extensa', 'Abertas', 'Planície, estepe']],
  ['mequinenza', 'Mequinenza', 'ES', 'aragao', 'Mequinenza · Caspe', 'Rio Ebro', 41.3, -0.1, ['siluro', 'carpa', 'achiga', 'lucioperca'], ['margem', 'embarcacao'], 'serra', 'Albufeira do Ebro conhecida como «Mar de Aragão». Na demonstração serve de exemplo para siluro e carpa.', ['Muito extensa', 'Íngremes, calcário', 'Vale árido']],
  ['ricobayo', 'Ricobayo', 'ES', 'castela-leao', 'Zamora', 'Rio Esla', 41.6, -5.9, ['lucio', 'achiga', 'carpa', 'lucioperca'], ['margem', 'caiaque', 'embarcacao'], 'vale', 'Albufeira do Esla com margens recortadas. Exemplo de pesca de lúcio na demonstração.', ['Extensa', 'Recortadas', 'Planalto']],
  ['iznajar', 'Iznájar', 'ES', 'andaluzia', 'Iznájar · Córdoba', 'Rio Genil', 37.25, -4.3, ['achiga', 'carpa', 'barbo'], ['margem', 'caiaque', 'embarcacao'], 'serra', 'Conhecida como «lago de Andaluzia», entre olivais. Exemplo de jornadas de margem e caiaque.', ['Extensa', 'Mistas', 'Olival, serra']],
  ['buendia', 'Buendía', 'ES', 'castela-mancha', 'Cuenca · Guadalajara', 'Rio Guadiela', 40.4, -2.75, ['achiga', 'carpa', 'lucio', 'lucioperca'], ['margem', 'embarcacao'], 'montanha', 'Albufeira de interior, com margens calcárias. Exemplo de jornadas embarcadas.', ['Extensa', 'Calcárias, íngremes', 'Meseta']],
]

export const DAMS: Dam[] = [
  ...PT_CORE,
  ...EXTRA.map(([id, name, country, region, place, river, lat, lon, species, modalities, preset, summary, traits], i): Dam => ({
    id,
    name,
    country,
    region,
    place,
    river,
    approx: { lat, lon },
    species,
    modalities,
    summary,
    traits: [
      { label: 'Escala', value: traits[0] },
      { label: 'Margens', value: traits[1] },
      { label: 'Ambiente', value: traits[2] },
    ],
    art: { ...PRESETS[preset], seed: 101 + i * 13 },
  })),
  ...MORE_DAMS.map(([id, name, country, region, place, river, lat, lon], i): Dam => {
    const preset: keyof typeof PRESETS = region === 'norte' || region === 'galiza' ? 'montanha' : region === 'centro' || region === 'castela-leao' ? 'vale' : region === 'algarve' || region === 'andaluzia' ? 'serra' : 'planicie'
    return {
      id,
      name,
      country,
      region,
      place,
      river,
      approx: { lat, lon },
      species: [],
      modalities: [],
      summary: `${country === 'PT' ? 'Albufeira' : 'Embalse'} em ${place} (${river}). Ficha com dados gerais: espécies, acessos e regras locais ainda não foram compilados.`,
      traits: [],
      art: { ...PRESETS[preset], seed: 401 + i * 7 },
      detail: 'basica',
    }
  }),
]

export const damById = Object.fromEntries(DAMS.map((d) => [d.id, d])) as Record<string, Dam>
