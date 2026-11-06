// Configuração central da marca: substituir aqui para mudar nome e assinatura em toda a app.
export const brand = {
  name: 'CatchAtlas',
  shortName: 'CatchAtlas',
  /** Logótipo (fundo transparente): versão normal para fundos claros e versão clara para fundos escuros. */
  logo: { src: '/brand/logo.png', srcLight: '/brand/logo-light.png', width: 1166, height: 226 },
  tagline: 'A tua próxima jornada começa aqui.',
  description:
    'Descobre barragens, prepara jornadas, regista capturas e acompanha rankings e provas.',
  demoLabel: 'Demonstração — dados ilustrativos',
  // Chaves antigas mantidas de propósito: mudar apagaria os dados já guardados no navegador.
  storageKey: 'atlascatch-demo-v1',
  photoDbName: 'atlascatch-demo-photos',
  themeColor: '#102B3A',
  /** Giveaway: 'mensal' no arranque; mudar para 'semanal' se a comunidade crescer. */
  giveaway: {
    frequency: 'mensal' as 'mensal' | 'semanal',
    prize: 'Kit de spinning: cana 2,10 m, carreto 2500 e caixa de amostras',
    maxEntries: 10,
  },
  subscription: {
    name: 'CatchAtlas Pro',
    /** Valor apenas ilustrativo: não há pagamentos na demonstração. */
    priceLabel: '3,99 €/mês (valor ilustrativo)',
  },
} as const
