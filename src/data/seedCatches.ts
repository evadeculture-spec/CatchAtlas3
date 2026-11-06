import type { Catch, SpeciesId } from './types'

type Seed = [
  id: string,
  anglerId: string,
  damId: string,
  speciesId: SpeciesId,
  weightG: number,
  lengthCm: number | undefined,
  dayOffset: number,
  technique: string,
  lure: string,
  released: boolean,
  notes: string,
]

// Capturas fictícias. dayOffset é relativo à data de referência da demonstração.
const SEEDS: Seed[] = [
  ['c01', 'eu', 'castelo-de-bode', 'achiga', 1840, 46, -3, 'Vinil texano', 'Craw 4" verde abóbora', true, 'Junto a uma árvore submersa, toque subtil.'],
  ['c02', 'eu', 'aguieira', 'achiga', 1120, 39, -11, 'Drop shot', 'Minnow 3" natural', true, 'Manhã com neblina.'],
  ['c03', 'eu', 'montargil', 'carpa', 8650, 78, -19, 'Carpfishing', 'Boilie frutado 20 mm', true, 'Sessão noturna, segunda picada da noite.'],
  ['c04', 'eu', 'alqueva', 'lucioperca', 2310, 58, -27, 'Jig', 'Vinil shad 4" branco', false, ''],
  ['c05', 'eu', 'cabril', 'barbo', 1650, 49, -40, 'Fundo / feeder', 'Milho doce', true, ''],
  ['c06', 'marta', 'alqueva', 'achiga', 2240, 50, -2, 'Superfície (topwater)', 'Stickbait 11 cm', true, ''],
  ['c07', 'marta', 'montargil', 'achiga', 1580, 44, -9, 'Crankbait', 'Crank médio vermelho', true, ''],
  ['c08', 'marta', 'maranhao', 'carpa', 11200, 86, -15, 'Carpfishing', 'Pellets e boilie', true, ''],
  ['c09', 'tiago', 'castelo-de-bode', 'achiga', 2050, 48, -5, 'Jig', 'Jig 10 g castanho', true, ''],
  ['c10', 'tiago', 'cabril', 'achiga', 960, 37, -13, 'Drop shot', 'Worm 4" roxo', true, ''],
  ['c11', 'tiago', 'aguieira', 'lucio', 4300, 82, -21, 'Spinning', 'Colher ondulante 20 g', true, ''],
  ['c12', 'ines', 'bouca', 'achiga', 1390, 42, -4, 'Vinil texano', 'Creature 4" preto', true, ''],
  ['c13', 'ines', 'aguieira', 'achiga', 1730, 45, -16, 'Spinning', 'Spinnerbait branco', true, ''],
  ['c14', 'ines', 'castelo-de-bode', 'carpa', 6400, 70, -33, 'Boia', 'Massa e milho', true, ''],
  ['c15', 'hugo', 'alqueva', 'siluro', 21500, 168, -7, 'Vertical', 'Vinil grande 20 cm', true, ''],
  ['c16', 'hugo', 'santa-clara', 'achiga', 2480, 51, -12, 'Vinil texano', 'Lagostim 3,5" verde', true, ''],
  ['c17', 'hugo', 'maranhao', 'lucioperca', 3150, 64, -24, 'Jig', 'Shad 5" pérola', false, ''],
  ['c18', 'bruno', 'montargil', 'carpa', 9800, 81, -6, 'Carpfishing', 'Tigernuts', true, ''],
  ['c19', 'bruno', 'santa-clara', 'achiga', 1210, 40, -18, 'Crankbait', 'Crank raso laranja', true, ''],
  ['c20', 'bruno', 'alqueva', 'achiga', 1960, 47, -45, 'Superfície (topwater)', 'Popper 7 cm', true, ''],
  ['c21', 'marta', 'santa-clara', 'barbo', 2120, 54, -29, 'Fundo / feeder', 'Minhoca', true, ''],
]

export function buildSeedCatches(addDays: (n: number) => string): Catch[] {
  return SEEDS.map(([id, anglerId, damId, speciesId, weightG, lengthCm, dayOffset, technique, lure, released, notes], i) => ({
    id,
    anglerId,
    damId,
    speciesId,
    weightG,
    lengthCm,
    date: addDays(dayOffset),
    technique,
    lure,
    notes,
    released,
    visibility: 'publica',
    ranking: true,
    hasPhoto: false,
    createdAt: i,
  }))
}
