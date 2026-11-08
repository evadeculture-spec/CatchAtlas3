import type { DataKind, EnrichmentStatus, EquipmentKind, JourneyStatus, LocationSource, Outcome, PinCategory, PingKind, Reliability, TimeSource, WaterEnvironment } from './types'

export const PIN_CATEGORIES: { id: PinCategory; label: string; color: string }[] = [
  { id: 'spot', label: 'Spot de pesca', color: '#20bfa9' },
  { id: 'captura', label: 'Local de captura', color: '#f2b544' },
  { id: 'acesso', label: 'Acesso', color: '#3e7cb1' },
  { id: 'estacionamento', label: 'Estacionamento', color: '#5b6b73' },
  { id: 'perigo', label: 'Perigo', color: '#c0392b' },
  { id: 'interesse', label: 'Ponto de interesse', color: '#8c6bb8' },
  { id: 'outro', label: 'Outro', color: '#8a9ba2' },
]
export const pinCategory = (id: PinCategory) => PIN_CATEGORIES.find((c) => c.id === id) ?? PIN_CATEGORIES[6]

export const ENVIRONMENTS: { id: WaterEnvironment; label: string }[] = [
  { id: 'albufeira', label: 'Albufeira' },
  { id: 'rio', label: 'Rio' },
  { id: 'lago', label: 'Lago / lagoa' },
  { id: 'canal', label: 'Canal' },
  { id: 'costa', label: 'Costa' },
  { id: 'mar', label: 'Mar' },
  { id: 'outro', label: 'Outro' },
]
export const environmentLabel = (id: WaterEnvironment | null) => ENVIRONMENTS.find((e) => e.id === id)?.label ?? '—'

/** Tipos de Ping: um report de experiência, não necessariamente uma captura. */
export const PING_KINDS: { id: PingKind; label: string; hint: string; color: string }[] = [
  { id: 'captura', label: 'Captura', hint: 'Apanhei peixe', color: '#20bfa9' },
  { id: 'tentativa', label: 'Tentativa', hint: 'Toques ou peixe perdido', color: '#f2b544' },
  { id: 'sem-captura', label: 'Sem captura', hint: 'Pesquei e não apanhei', color: '#8a9ba2' },
  { id: 'observacao', label: 'Observação', hint: 'Atividade, isco, peixe à vista', color: '#3e7cb1' },
  { id: 'condicoes', label: 'Condições', hint: 'Água, nível, acesso, tempo', color: '#5b8fa8' },
  { id: 'evento', label: 'Evento', hint: 'Prova, encontro, outro', color: '#8c6bb8' },
]
export const pingKind = (id: PingKind) => PING_KINDS.find((k) => k.id === id) ?? PING_KINDS[3]

export const TIME_SOURCE: Record<TimeSource, string> = { 'foto-exif': 'Metadados da fotografia', dispositivo: 'Relógio do dispositivo', manual: 'Indicada manualmente' }
export const RELIABILITY: Record<Reliability, string> = { alta: 'alta', media: 'média', baixa: 'baixa' }
export const LOCATION_SOURCE: Record<LocationSource, string> = { gps: 'GPS do dispositivo', mapa: 'Escolhida no mapa', 'foto-exif': 'Metadados da fotografia', pin: 'Posição do pin', nenhuma: 'Sem localização' }
export const OUTCOMES: { id: Outcome; label: string }[] = [
  { id: 'sucesso', label: 'Com sucesso' },
  { id: 'parcial', label: 'Parcial' },
  { id: 'sem-sucesso', label: 'Sem sucesso' },
]

export const ENRICHMENT: Record<EnrichmentStatus, { label: string; tone: 'teal' | 'amber' | 'neutral' }> = {
  pendente: { label: 'Condições em fila', tone: 'neutral' },
  'em-curso': { label: 'A obter condições…', tone: 'neutral' },
  concluido: { label: 'Condições obtidas', tone: 'teal' },
  parcial: { label: 'Condições parciais', tone: 'amber' },
  falhou: { label: 'Condições indisponíveis', tone: 'amber' },
  'sem-localizacao': { label: 'Sem localização: sem condições', tone: 'neutral' },
}

/** Natureza do dado ambiental: nunca se apresenta um valor de modelo como observação. */
export const DATA_KIND: Record<DataKind | 'calculado' | 'indisponivel', { label: string; text: string }> = {
  estimado: { label: 'Estimativa de modelo', text: 'Valor de um modelo meteorológico para a célula da grelha (~1–11 km), não uma medição no local.' },
  historico: { label: 'Histórico (reanálise)', text: 'Reanálise ERA5 do Copernicus: reconstrução histórica com resolução de ~9–25 km.' },
  previsao: { label: 'Previsão', text: 'Previsão de modelo: pode mudar até ao dia. Confirme antes de sair.' },
  calculado: { label: 'Calculado', text: 'Cálculo astronómico local (SunCalc).' },
  indisponivel: { label: 'Indisponível', text: 'Sem fonte integrada para este dado.' },
}

export const JOURNEY_STATUS: Record<JourneyStatus, string> = { planeada: 'Planeada', 'em-curso': 'Em curso', concluida: 'Concluída', arquivada: 'Arquivada' }

export const EQUIPMENT_KINDS: { id: EquipmentKind; label: string }[] = [
  { id: 'cana', label: 'Cana' },
  { id: 'carreto', label: 'Carreto' },
  { id: 'linha', label: 'Linha' },
  { id: 'amostra', label: 'Amostra' },
  { id: 'isco', label: 'Isco' },
  { id: 'acessorio', label: 'Acessório' },
  { id: 'embarcacao', label: 'Embarcação' },
  { id: 'outro', label: 'Outro' },
]

export const MODALITIES = [
  { id: 'margem', label: 'Margem' },
  { id: 'caiaque', label: 'Caiaque / pato' },
  { id: 'float-tube', label: 'Float tube' },
  { id: 'embarcacao', label: 'Embarcação' },
  { id: 'surfcasting', label: 'Surfcasting' },
  { id: 'rockfishing', label: 'Rockfishing' },
  { id: 'pluma', label: 'Pesca à pluma' },
]
export const modalityLabel = (id: string | null | undefined) => (id ? MODALITIES.find((m) => m.id === id)?.label ?? id : '—')
export const BOAT_MODALITIES = ['caiaque', 'float-tube', 'embarcacao']

/** Sugestões (texto livre aceite). */
export const SPECIES_SUGGESTIONS = ['Achigã', 'Carpa', 'Lúcio', 'Lucioperca', 'Barbo', 'Siluro', 'Truta', 'Boga', 'Perca-sol', 'Pimpão', 'Black bass', 'Robalo', 'Dourada', 'Sargo', 'Corvina', 'Lula', 'Choco', 'Cavala', 'Anchova']
export const TECHNIQUE_SUGGESTIONS = ['Spinning', 'Vinil texano', 'Drop shot', 'Jig', 'Superfície (topwater)', 'Crankbait', 'Jerkbait', 'Fundo / feeder', 'Carpfishing', 'Boia', 'Vertical', 'Corrico', 'Pluma seca', 'Ninfa']
export const BAIT_SUGGESTIONS = ['Vinil', 'Minhoca', 'Milho', 'Boilie', 'Pão', 'Camarão', 'Casulo', 'Lingueirão', 'Sardinha', 'Amostra dura', 'Colher', 'Spinnerbait']

/** "1 sessão" / "3 sessões". */
export const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`
