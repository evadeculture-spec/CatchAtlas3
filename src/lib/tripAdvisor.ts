import type { ModalityId, SpeciesId } from '../data/types'
import type { Conditions } from './weather'

// Regras simples e transparentes para gerar sugestões ILUSTRATIVAS.
// Não são previsões de sucesso: apenas reagem às escolhas e às condições simuladas.

export interface Approach {
  id: string
  title: string
  setup: string
  why: string
}

interface Rule extends Omit<Approach, 'why'> {
  species: SpeciesId
  modalities?: ModalityId[]
  score: (c: Conditions) => number
  why: (c: Conditions) => string
}

const calm = (c: Conditions) => c.wind < 12
const windy = (c: Conditions) => c.wind >= 14
const cloudy = (c: Conditions) => c.sky === 'nublado' || c.sky === 'chuva-fraca'
const sunny = (c: Conditions) => c.sky === 'limpo'
const coldWater = (c: Conditions) => c.water < 14
const warmWater = (c: Conditions) => c.water >= 19

const RULES: Rule[] = [
  // Achigã
  { id: 'a-top', species: 'achiga', title: 'Superfície nas primeiras horas', setup: 'Stickbait ou popper, recolha com pausas',
    score: (c) => (calm(c) ? 3 : 0) + (warmWater(c) ? 2 : 0) + (cloudy(c) ? 1 : 0) - (coldWater(c) ? 3 : 0),
    why: (c) => `Com vento ${calm(c) ? 'fraco' : 'moderado'} e água a ${c.water} °C (simulado), a superfície é uma abordagem a experimentar quando a luz ainda é baixa.` },
  { id: 'a-texas', species: 'achiga', title: 'Vinil texano em estruturas', setup: 'Creature ou lagostim, chumbo bala 7–10 g',
    score: (c) => 2 + (sunny(c) ? 2 : 0) + (c.pressureTrend === 'a subir' ? 1 : 0),
    why: (c) => `${sunny(c) ? 'Com céu limpo' : 'Mesmo com nuvens'}, trabalhar devagar junto a árvores submersas, pedras e sombras permite explorar zonas de abrigo.` },
  { id: 'a-drop', species: 'achiga', title: 'Drop shot em taludes', setup: 'Worm fino, anzol 1/0, chumbo 5–10 g',
    modalities: ['caiaque', 'embarcacao', 'margem'],
    score: (c) => (coldWater(c) ? 3 : 0) + (sunny(c) ? 1 : 0) + (c.pressureTrend === 'a descer' ? 1 : 0) + 1,
    why: (c) => `Água a ${c.water} °C e pressão ${c.pressureTrend}: uma apresentação lenta e fina, mais funda, é uma alternativa a experimentar.` },
  { id: 'a-spinner', species: 'achiga', title: 'Spinnerbait nas margens batidas', setup: 'Spinnerbait 10–14 g, cor branca ou chartreuse',
    score: (c) => (windy(c) ? 4 : 0) + (cloudy(c) ? 2 : 0),
    why: (c) => `Com vento de ${c.wind} km/h (simulado), as margens onde a ondulação bate são uma zona a explorar com amostras de vibração.` },
  { id: 'a-crank', species: 'achiga', title: 'Crankbait em pontas de terra', setup: 'Crank médio, recolha constante a tocar no fundo',
    score: (c) => (c.water >= 14 && c.water <= 22 ? 2 : 0) + (c.wind >= 8 && c.wind < 20 ? 1 : 0) + 1,
    why: () => 'Cobrir água rapidamente em pontas e transições ajuda a perceber a que profundidade há atividade.' },
  { id: 'a-jig', species: 'achiga', title: 'Jig lento no fundo', setup: 'Jig 10–14 g com trailer',
    modalities: ['margem', 'caiaque', 'embarcacao'],
    score: (c) => (coldWater(c) ? 3 : 0) + (c.pressureTrend !== 'estável' ? 1 : 0),
    why: (c) => `Em água mais fria (${c.water} °C simulados), movimentos curtos e pausas longas são uma abordagem a experimentar.` },
  // Carpa
  { id: 'c-night', species: 'carpa', title: 'Sessão ao entardecer e noite', setup: 'Montagem de chumbada fixa, boilie 18–20 mm',
    score: (c) => (warmWater(c) ? 3 : 1) + (sunny(c) ? 1 : 0),
    why: (c) => `Com máximas de ${c.airMax} °C (simulado), o fim do dia é uma janela a experimentar para iscos de fundo.` },
  { id: 'c-reeds', species: 'carpa', title: 'Junto a canaviais e margens rasas', setup: 'Milho e pellets, montagem discreta',
    score: (c) => (warmWater(c) ? 2 : 0) + (calm(c) ? 2 : 0),
    why: () => 'Zonas rasas e abrigadas aquecem primeiro e merecem ser observadas antes de iscar.' },
  { id: 'c-popup', species: 'carpa', title: 'Pop-up sobre fundo com detritos', setup: 'Pop-up visível, linha de baixo de fluorocarbono',
    score: (c) => (coldWater(c) ? 3 : 1) + (cloudy(c) ? 1 : 0),
    why: () => 'Um isco ligeiramente elevado mantém-se visível em fundos irregulares.' },
  { id: 'c-zig', species: 'carpa', title: 'Zig rig a meia água', setup: 'Zig com espuma, comprimento ajustável',
    score: (c) => (sunny(c) ? 2 : 0) + (warmWater(c) ? 2 : 0) + (calm(c) ? 1 : 0),
    why: () => 'Em dias limpos e quentes, testar diferentes profundidades a meia água é uma abordagem a experimentar.' },
  { id: 'c-wind', species: 'carpa', title: 'Margem de frente para o vento', setup: 'Engodo moderado, chumbada 90–110 g',
    score: (c) => (windy(c) ? 4 : 0),
    why: (c) => `Com vento de ${c.windDir} (simulado), a margem que recebe a ondulação pode concentrar alimento.` },
  // Lúcio
  { id: 'l-spoon', species: 'lucio', title: 'Ondulante em bancos de vegetação', setup: 'Colher 15–25 g, recolha irregular',
    score: (c) => 2 + (cloudy(c) ? 2 : 0),
    why: () => 'Margens com vegetação e luz difusa são zonas a explorar com amostras de reflexo.' },
  { id: 'l-soft', species: 'lucio', title: 'Vinil grande, recolha lenta', setup: 'Shad 12–15 cm, empate de aço',
    score: (c) => (coldWater(c) ? 3 : 1),
    why: () => 'Uma apresentação maior e lenta é uma alternativa a experimentar em água mais fria.' },
  { id: 'l-jerk', species: 'lucio', title: 'Jerkbait suspensivo', setup: 'Jerkbait 11–13 cm, pausas de 3–5 s',
    score: (c) => (sunny(c) ? 2 : 0) + (calm(c) ? 1 : 0) + 1,
    why: () => 'Pausas longas permitem explorar diferentes níveis de atividade.' },
  { id: 'l-spinner', species: 'lucio', title: 'Spinnerbait em margens com vento', setup: 'Spinnerbait 20 g com empate',
    score: (c) => (windy(c) ? 3 : 0),
    why: (c) => `Com ${c.wind} km/h de vento simulado, amostras com vibração ajudam a cobrir água agitada.` },
  // Lucioperca
  { id: 'z-jig', species: 'lucioperca', title: 'Jig shad no fundo', setup: 'Cabeçote 10–20 g, shad 10 cm',
    score: (c) => 2 + (cloudy(c) ? 1 : 0),
    why: () => 'Pontas rochosas e quedas de profundidade são estruturas a experimentar com toques no fundo.' },
  { id: 'z-vertical', species: 'lucioperca', title: 'Vertical sobre taludes', setup: 'Vinil 8–10 cm em vertical, sonda',
    modalities: ['embarcacao', 'caiaque'],
    score: (c) => 3 + (calm(c) ? 1 : 0),
    why: () => 'A partir de embarcação, a pesca vertical permite controlar a profundidade com precisão.' },
  { id: 'z-dusk', species: 'lucioperca', title: 'Drop shot ao entardecer', setup: 'Minnow fino, chumbo 10 g',
    score: (c) => 1 + (sunny(c) ? 2 : 0),
    why: (c) => `Com céu ${sunny(c) ? 'limpo' : 'variável'}, a luz baixa do fim do dia é uma janela a experimentar.` },
  // Barbo
  { id: 'b-feeder', species: 'barbo', title: 'Feeder junto a entradas de água', setup: 'Cesto de engodo 30–40 g, anzol 10',
    score: (c) => 2 + (cloudy(c) ? 1 : 0),
    why: () => 'Entradas de ribeiras e zonas com alguma corrente são pontos a explorar com engodo regular.' },
  { id: 'b-bottom', species: 'barbo', title: 'Fundo com isco natural', setup: 'Milho, minhoca ou massa',
    score: (c) => 2 + (warmWater(c) ? 1 : 0),
    why: () => 'Uma montagem simples de fundo é uma boa base para comparar iscos.' },
  { id: 'b-float', species: 'barbo', title: 'Boia junto à margem', setup: 'Boia 3–4 g, linha fina',
    score: (c) => (calm(c) ? 3 : 0),
    why: () => 'Com pouco vento, a boia permite ler toques subtis perto da margem.' },
  // Siluro
  { id: 's-vertical', species: 'siluro', title: 'Vertical com vinil grande', setup: 'Vinil 18–25 cm, cabeçote 40–60 g',
    modalities: ['embarcacao'],
    score: () => 4,
    why: () => 'A partir de embarcação, explorar fossas e canais com vertical é uma abordagem a experimentar.' },
  { id: 's-night', species: 'siluro', title: 'Fundo ao anoitecer', setup: 'Isco volumoso, linha e anzol robustos',
    score: (c) => 2 + (warmWater(c) ? 2 : 0),
    why: () => 'Em água quente, o fim do dia é uma janela a experimentar com montagens robustas.' },
  { id: 's-spin', species: 'siluro', title: 'Spinning junto a estruturas fundas', setup: 'Vinil grande ou colher pesada',
    score: (c) => 2 + (cloudy(c) ? 1 : 0),
    why: () => 'Lançamentos longos sobre estruturas profundas ajudam a cobrir território.' },
]

export function suggestApproaches(species: SpeciesId, modality: ModalityId, c: Conditions): Approach[] {
  return RULES.filter((r) => r.species === species && (!r.modalities || r.modalities.includes(modality)))
    .map((r) => ({ r, s: r.score(c) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 3)
    .map(({ r }) => ({ id: r.id, title: r.title, setup: r.setup, why: r.why(c) }))
}

export interface TimeWindow {
  start: string
  end: string
  label: string
  why: string
}

const toMin = (t: string) => {
  const [h, m] = t.split(':').map(Number)
  return h * 60 + m
}
const fromMin = (m: number) => {
  const r = Math.round(m / 15) * 15
  return `${String(Math.floor(r / 60) % 24).padStart(2, '0')}:${String(r % 60).padStart(2, '0')}`
}

export function suggestWindow(species: SpeciesId, c: Conditions): TimeWindow {
  const rise = toMin(c.sunrise)
  const set = toMin(c.sunset)
  const predator = species === 'achiga' || species === 'lucio' || species === 'lucioperca'
  if (predator && coldWater(c))
    return { start: '11:30', end: '16:00', label: 'Meio do dia', why: `Com água fria (${c.water} °C simulados), as horas em que a água aquece um pouco são uma janela a experimentar.` }
  if (predator && cloudy(c))
    return { start: fromMin(rise), end: fromMin(rise + 300), label: 'Manhã alargada', why: 'Com céu encoberto, a luz baixa prolonga-se. Sugerimos começar cedo e manter a manhã.' }
  if (predator)
    return { start: fromMin(rise - 30), end: fromMin(rise + 150), label: 'Amanhecer', why: `O nascer do sol (${c.sunrise}) e as primeiras horas de luz baixa são uma janela a experimentar.` }
  if (species === 'carpa' || species === 'siluro')
    return warmWater(c)
      ? { start: fromMin(set - 90), end: fromMin(set + 180), label: 'Entardecer e noite', why: `Com água a ${c.water} °C (simulado), o fim do dia e o início da noite são uma janela a experimentar.` }
      : { start: '13:00', end: fromMin(set), label: 'Tarde', why: 'Com água mais fresca, a tarde é a fase em que a água está mais quente.' }
  return { start: '09:30', end: '13:30', label: 'Manhã', why: 'Uma manhã calma permite ler bem a água e ajustar o engodo.' }
}

export interface ChecklistItem {
  id: string
  label: string
  group: 'Essencial' | 'Segurança' | 'Material' | 'Conforto'
}

export function buildChecklist(species: SpeciesId, modality: ModalityId, c: Conditions, approaches: Approach[], window: TimeWindow): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { id: 'licenca', label: 'Licença de pesca válida (confirmar requisitos)', group: 'Essencial' },
    { id: 'regras', label: 'Confirmar regras e zonas permitidas no local', group: 'Essencial' },
    { id: 'alicate', label: 'Alicate de desanzolar', group: 'Material' },
    { id: 'regua', label: 'Régua de medição para registo', group: 'Material' },
    { id: 'telemovel', label: 'Telemóvel carregado e bateria extra', group: 'Segurança' },
    { id: 'agua', label: 'Água e comida para a jornada', group: 'Conforto' },
  ]
  if (modality !== 'margem') {
    items.push({ id: 'colete', label: 'Colete salva-vidas', group: 'Segurança' })
    items.push({ id: 'aviso', label: 'Avisar alguém do plano e hora de regresso', group: 'Segurança' })
    if (c.wind >= 14) items.push({ id: 'ancora', label: 'Âncora ou estaca para o vento', group: 'Material' })
  }
  if (modality === 'margem') items.push({ id: 'calcado', label: 'Calçado com boa aderência', group: 'Segurança' })
  if (species === 'carpa' || species === 'siluro') items.push({ id: 'tapete', label: 'Tapete de receção', group: 'Material' })
  if (species === 'lucio' || species === 'siluro') items.push({ id: 'empate', label: 'Empates de aço ou linha robusta', group: 'Material' })
  if (species !== 'barbo') items.push({ id: 'camaroeiro', label: 'Camaroeiro', group: 'Material' })
  const ws = toMin(window.start)
  if (ws < toMin(c.sunrise) + 30 || toMin(window.end) > toMin(c.sunset)) items.push({ id: 'frontal', label: 'Lanterna frontal', group: 'Segurança' })
  if (c.sky === 'limpo' || c.airMax >= 26) items.push({ id: 'sol', label: 'Protetor solar, boné e óculos polarizados', group: 'Conforto' })
  if (c.sky === 'chuva-fraca' || c.sky === 'nublado') items.push({ id: 'impermeavel', label: 'Casaco impermeável', group: 'Conforto' })
  if (c.airMin <= 10) items.push({ id: 'frio', label: 'Camadas quentes para o início do dia', group: 'Conforto' })
  approaches.forEach((a) => items.push({ id: `amostra-${a.id}`, label: a.setup, group: 'Material' }))
  return items
}
