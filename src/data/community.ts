import type { Activity, ChatMessage, DayPeriod, Listing, ListingCategory, RegionId, Report, SpeciesId } from './types'

// Reports, anúncios e mensagens fictícios. Os desvios de dias são relativos à data de referência.

type ReportSeed = [string, string, string, SpeciesId, Activity, DayPeriod, number, string, string, number, string]
const REPORTS: ReportSeed[] = [
  ['r01', 'marta', 'alqueva', 'achiga', 'forte', 'manha', 0, 'Superfície (topwater)', 'Stickbait 11 cm', 4, 'Atividade nas enseadas com vento fraco.'],
  ['r02', 'tiago', 'castelo-de-bode', 'achiga', 'moderada', 'manha', 0, 'Drop shot', 'Worm 4"', 2, 'Peixe a 6–8 m junto às árvores.'],
  ['r03', 'hugo', 'alqueva', 'siluro', 'forte', 'noite', -1, 'Vertical', 'Vinil 20 cm', 1, ''],
  ['r04', 'ines', 'aguieira', 'achiga', 'fraca', 'tarde', -1, 'Vinil texano', 'Creature 4"', 1, 'Água a subir de cor depois da chuva.'],
  ['r05', 'bruno', 'montargil', 'carpa', 'forte', 'noite', -1, 'Carpfishing', 'Tigernuts', 3, ''],
  ['r06', 'javier', 'alcantara', 'achiga', 'forte', 'manha', -1, 'Crankbait', 'Crank médio', 6, 'Muito peixe nas pontas com vento.'],
  ['r07', 'lucia', 'mequinenza', 'siluro', 'moderada', 'tarde', -2, 'Spinning', 'Vinil grande', 2, ''],
  ['r08', 'marta', 'maranhao', 'lucioperca', 'moderada', 'madrugada', -2, 'Jig', 'Shad 4"', 2, ''],
  ['r09', 'tiago', 'cabril', 'achiga', 'nula', 'tarde', -2, 'Spinning', 'Spinnerbait', 0, 'Vento forte, sem toques.'],
  ['r10', 'hugo', 'santa-clara', 'achiga', 'forte', 'manha', -3, 'Vinil texano', 'Lagostim 3,5"', 5, ''],
  ['r11', 'ines', 'bouca', 'barbo', 'moderada', 'manha', -3, 'Fundo / feeder', 'Milho', 3, ''],
  ['r12', 'javier', 'orellana', 'carpa', 'moderada', 'noite', -3, 'Carpfishing', 'Boilie 20 mm', 2, ''],
  ['r13', 'bruno', 'pego-do-altar', 'achiga', 'fraca', 'tarde', -4, 'Drop shot', 'Minnow 3"', 1, ''],
  ['r14', 'lucia', 'buendia', 'lucio', 'moderada', 'manha', -4, 'Spinning', 'Colher 20 g', 1, ''],
  ['r15', 'marta', 'roxo', 'achiga', 'forte', 'manha', -5, 'Superfície (topwater)', 'Popper 7 cm', 4, ''],
  ['r16', 'tiago', 'canicada', 'achiga', 'moderada', 'tarde', -5, 'Jig', 'Jig 10 g', 2, ''],
  ['r17', 'hugo', 'odeleite', 'achiga', 'moderada', 'manha', -6, 'Crankbait', 'Crank raso', 2, ''],
  ['r18', 'javier', 'la-serena', 'achiga', 'forte', 'manha', -6, 'Spinning', 'Swimbait 3"', 7, ''],
  ['r19', 'ines', 'baixo-sabor', 'achiga', 'moderada', 'tarde', -8, 'Vinil texano', 'Craw 4"', 2, ''],
  ['r20', 'lucia', 'ricobayo', 'lucio', 'forte', 'manha', -9, 'Spinning', 'Jerkbait 12 cm', 3, ''],
  ['r21', 'bruno', 'idanha', 'carpa', 'fraca', 'noite', -11, 'Carpfishing', 'Pellets', 1, ''],
  ['r22', 'marta', 'caia', 'lucioperca', 'moderada', 'madrugada', -13, 'Jig', 'Shad 5"', 2, ''],
  ['r23', 'javier', 'valdecanas', 'siluro', 'forte', 'noite', -15, 'Vertical', 'Vinil 25 cm', 1, ''],
  ['r24', 'tiago', 'alto-rabagao', 'achiga', 'fraca', 'tarde', -18, 'Spinning', 'Spinnerbait', 1, ''],
  ['r25', 'lucia', 'iznajar', 'achiga', 'moderada', 'manha', -22, 'Drop shot', 'Worm 4"', 3, ''],
]

export function buildSeedReports(addDays: (n: number) => string): Report[] {
  return REPORTS.map(([id, anglerId, damId, speciesId, activity, period, off, technique, lure, catches, note], i) => ({
    id, anglerId, damId, speciesId, activity, period, date: addDays(off), technique, lure, catches, note, createdAt: i, seeded: true,
  }))
}

type ListingSeed = [string, string, string, ListingCategory, number, Listing['condition'], RegionId, number, string]
const LISTINGS: ListingSeed[] = [
  ['m01', 'tiago', 'Cana spinning 2,13 m, ação média', 'canas', 65, 'como-novo', 'centro', -1, 'Usada meia dúzia de vezes em barragem. Ideal para vinis e cranks leves.'],
  ['m02', 'marta', 'Carreto baitcasting 7.3:1', 'carretos', 90, 'usado', 'alentejo', -2, 'Funciona sem problemas, travão revisto. Vendo por ter passado a spinning.'],
  ['m03', 'hugo', 'Lote de 12 vinis de 4"', 'amostras', 18, 'novo', 'alentejo', -2, 'Cores naturais e lagostim. Embalagens por abrir.'],
  ['m04', 'bruno', 'Float tube com barbatanas', 'embarcacoes', 210, 'usado', 'lisboa', -4, 'Inclui bomba e bolsa. Sem fugas.'],
  ['m05', 'ines', 'Sonda portátil com GPS', 'eletronica', 240, 'como-novo', 'centro', -5, 'Com suporte para caiaque e bateria.'],
  ['m06', 'javier', 'Cana de siluro 2,70 m', 'canas', 75, 'usado', 'extremadura', -6, 'Cana robusta para vertical e spinning pesado.'],
  ['m07', 'lucia', 'Caixa de amostras com 30 peças', 'amostras', 55, 'usado', 'aragao', -7, 'Cranks, jerkbaits e colheres. Algumas com marcas de uso.'],
  ['m08', 'marta', 'Alicate e grip de alumínio', 'acessorios', 22, 'novo', 'alentejo', -9, 'Conjunto novo, oferta repetida.'],
  ['m09', 'tiago', 'Caiaque de pesca 3,6 m', 'embarcacoes', 520, 'usado', 'centro', -12, 'Com porta-canas e assento alto. Levantamento no local.'],
  ['m10', 'hugo', 'Carreto spinning 3000', 'carretos', 45, 'usado', 'alentejo', -14, 'Bom estado, linha nova.'],
]

export function buildSeedListings(addDays: (n: number) => string): Listing[] {
  return LISTINGS.map(([id, sellerId, title, category, priceEur, condition, region, off, description], i) => ({
    id, sellerId, title, category, priceEur, condition, region, date: addDays(off), description, hasPhoto: false, sold: false, createdAt: i,
  }))
}

type ChatSeed = [string, string, number, string, string]
const CHAT: ChatSeed[] = [
  ['h01', 'marta', -2, '19:42', 'Alguém vai ao Alqueva este fim de semana? Ontem à tarde as enseadas estavam com muita atividade.'],
  ['h02', 'hugo', -2, '19:50', 'Vou sábado de madrugada. Vou experimentar superfície nas primeiras horas.'],
  ['h03', 'javier', -2, '20:05', '¡Buenas! En Alcántara ayer muy bien con crankbait en las puntas. Sigo el canal desde Cáceres.'],
  ['h04', 'tiago', -2, '21:12', 'Castelo de Bode com o peixe fundo, 6–8 m. Drop shot foi o que resultou.'],
  ['h05', 'ines', -1, '07:03', 'Bom dia! Alguém sabe se a água na Aguieira já limpou depois da chuva?'],
  ['h06', 'bruno', -1, '07:18', 'Passei lá anteontem, ainda estava turva nos braços. No corpo principal estava melhor.'],
  ['h07', 'lucia', -1, '08:26', 'Mequinenza com siluros activos al atardecer. Si alguien viene, aviso en el canal.'],
  ['h08', 'marta', -1, '09:40', 'Lembrem-se de registar as capturas: contam para o giveaway deste mês.'],
]

export function buildSeedChat(addDays: (n: number) => string): ChatMessage[] {
  return CHAT.map(([id, anglerId, off, time, text]) => ({ id, anglerId, text, at: `${addDays(off)}T${time}` }))
}
