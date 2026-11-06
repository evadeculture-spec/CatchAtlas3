import type { DemoEvent } from './types'

// Provas fictícias. Organizadores e resultados são inventados para demonstração.
export const EVENTS: DemoEvent[] = [
  {
    id: 'open-outono-montargil',
    title: 'Open de Outono · Achigã',
    damId: 'montargil',
    modality: 'embarcacao',
    dayOffset: 12,
    startTime: '07:00',
    organizer: 'Clube Exemplo de Pesca do Sor (fictício)',
    format: 'Pares embarcados · captura e solta · 5 exemplares por equipa',
    description:
      'Prova de demonstração que ilustra como uma competição apareceria no produto: calendário, regras resumidas, horários e, depois do evento, resultados publicados.',
    schedule: [
      { time: '06:00', label: 'Concentração e briefing' },
      { time: '07:00', label: 'Partida' },
      { time: '14:00', label: 'Chegada e pesagem' },
      { time: '15:30', label: 'Classificação' },
    ],
    speciesFocus: ['achiga'],
  },
  {
    id: 'taca-margens-bode',
    title: 'Taça Margens do Zêzere',
    damId: 'castelo-de-bode',
    modality: 'margem',
    dayOffset: 26,
    startTime: '08:00',
    organizer: 'Associação Demo Centro (fictícia)',
    format: 'Individual de margem · setores sorteados · 4 horas',
    description:
      'Exemplo de prova de margem com setores sorteados. Nesta demonstração não há inscrições reais: a ficha mostra apenas a estrutura de informação.',
    schedule: [
      { time: '07:00', label: 'Sorteio de setores' },
      { time: '08:00', label: 'Início' },
      { time: '12:00', label: 'Fim e medição' },
    ],
    speciesFocus: ['achiga', 'barbo'],
  },
  {
    id: 'kayak-santa-clara',
    title: 'Encontro Kayak Santa Clara',
    damId: 'santa-clara',
    modality: 'caiaque',
    dayOffset: 41,
    startTime: '07:30',
    organizer: 'Grupo Kayak Sul (fictício)',
    format: 'Individual em caiaque · foto na régua · 3 maiores exemplares',
    description:
      'Formato de demonstração com validação por fotografia na régua, pensado para mostrar como o registo de capturas pode apoiar provas.',
    schedule: [
      { time: '06:45', label: 'Verificação de equipamento de segurança' },
      { time: '07:30', label: 'Partida' },
      { time: '13:30', label: 'Entrega de fotografias' },
    ],
    speciesFocus: ['achiga'],
  },
  {
    id: 'noite-carpa-alqueva',
    title: '24 h de Carpa · Alqueva',
    damId: 'alqueva',
    modality: 'margem',
    dayOffset: 58,
    startTime: '12:00',
    organizer: 'Carp Team Exemplo (fictício)',
    format: 'Equipas de 2 · 24 horas · pesagem acumulada',
    description:
      'Prova fictícia de longa duração, útil para ilustrar provas de carpa com pesagens acumuladas.',
    schedule: [
      { time: '10:00', label: 'Sorteio de pesqueiros' },
      { time: '12:00', label: 'Início' },
      { time: '12:00 (+1)', label: 'Fim e classificação' },
    ],
    speciesFocus: ['carpa'],
  },
  {
    id: 'open-siluro-mequinenza',
    title: 'Open Ibérico de Siluro',
    damId: 'mequinenza',
    modality: 'embarcacao',
    dayOffset: 33,
    startTime: '08:00',
    organizer: 'Club Ejemplo del Ebro (fictício)',
    format: 'Pares embarcados · captura e solta · medição em régua',
    description:
      'Prova fictícia em Espanha, para ilustrar como o calendário pode cruzar a fronteira e juntar pescadores dos dois países.',
    schedule: [
      { time: '07:00', label: 'Briefing' },
      { time: '08:00', label: 'Partida' },
      { time: '16:00', label: 'Entrega de fotografias e medições' },
    ],
    speciesFocus: ['siluro'],
  },
  {
    id: 'trofeu-primavera-aguieira',
    title: 'Troféu Aguieira · Achigã',
    damId: 'aguieira',
    modality: 'embarcacao',
    dayOffset: -34,
    startTime: '07:00',
    organizer: 'Clube Exemplo do Mondego (fictício)',
    format: 'Pares embarcados · captura e solta',
    description: 'Prova anterior fictícia, com resultados de demonstração.',
    schedule: [
      { time: '07:00', label: 'Partida' },
      { time: '14:00', label: 'Pesagem' },
    ],
    speciesFocus: ['achiga'],
    results: [
      { name: 'Equipa Azul (fictícia)', weightG: 8420, catches: 5, biggestG: 2310 },
      { name: 'Equipa Margem Norte (fictícia)', weightG: 7960, catches: 5, biggestG: 1980 },
      { name: 'Equipa Xisto (fictícia)', weightG: 7140, catches: 5, biggestG: 2050 },
      { name: 'Equipa Ribeira (fictícia)', weightG: 6230, catches: 4, biggestG: 1870 },
      { name: 'Equipa Planalto (fictícia)', weightG: 5510, catches: 4, biggestG: 1640 },
    ],
  },
  {
    id: 'taca-maranhao',
    title: 'Taça Maranhão · Predadores',
    damId: 'maranhao',
    modality: 'embarcacao',
    dayOffset: -63,
    startTime: '07:30',
    organizer: 'Associação Demo Alentejo (fictícia)',
    format: 'Individual embarcado · achigã e lucioperca',
    description: 'Prova anterior fictícia, com resultados de demonstração.',
    schedule: [
      { time: '07:30', label: 'Partida' },
      { time: '14:30', label: 'Pesagem' },
    ],
    speciesFocus: ['achiga', 'lucioperca'],
    results: [
      { name: 'Participante A (fictício)', weightG: 6890, catches: 5, biggestG: 2640 },
      { name: 'Participante B (fictício)', weightG: 6120, catches: 5, biggestG: 1910 },
      { name: 'Participante C (fictício)', weightG: 5480, catches: 4, biggestG: 2200 },
      { name: 'Participante D (fictício)', weightG: 4310, catches: 4, biggestG: 1460 },
    ],
  },
]

export const eventById = Object.fromEntries(EVENTS.map((e) => [e.id, e])) as Record<string, DemoEvent>
