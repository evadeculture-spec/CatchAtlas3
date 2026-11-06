import type { FishingZone } from './types'

// Concessões e zonas de pesca com documento oficial identificado (consultado a 31/10/2026).
// Exceção assinalada com evidence: 'noticia' — referida só em notícia, sem documento oficial localizado.
// Lista PARCIAL: a lista completa portuguesa está no geocatálogo do ICNF ("Concessões de pesca",
// "Zonas de pesca reservada"). Os resumos não substituem o regulamento nem o edital.
// osmWater: albufeira do OpenStreetMap usada para a zona aparecer no mapa (associação por nome e operador).
const icnf = (id: string) => `https://www.icnf.pt/api/file/doc/${id}`

export const ZONES: FishingZone[] = [
  {
    id: 'zpl-canicada-geres', name: 'Zona de Pesca Lúdica e Desportiva — Albufeira da Caniçada e Rio Gerês', country: 'PT', kind: 'zpl', damId: 'canicada', river: 'Rio Cávado · Rio Gerês', place: 'Vieira do Minho · Terras de Bouro',
    notes: ['Edital de 9 de março de 2026, para 2026 e anos seguintes.', 'Espécies autorizadas no edital: truta-de-rio, boga, escalo, barbo, perca-sol, achigã, carpa, lúcio e pimpão.', 'Permite pesca sem morte, com devolução imediata dos exemplares.', 'A entidade gestora pode autorizar provas de pesca desportiva.'],
    source: { label: 'Edital 2026 (ICNF)', url: icnf('5d82ef48696e0f46') }, docYear: 2026,
  },
  {
    id: 'zpl-rio-homem', name: 'Zona de Pesca Lúdica do Rio Homem', country: 'PT', kind: 'zpl', damId: 'vilarinho-das-furnas', river: 'Rio Homem', place: 'Terras de Bouro',
    notes: ['Edital de 2026.', 'Inclui parte da albufeira de Vilarinho das Furnas, com restrições do plano do Parque Nacional da Peneda-Gerês.', 'Troços com regras e preços diários próprios.'],
    source: { label: 'Edital 2026 (ICNF)', url: icnf('6c61b665c00254b1') }, docYear: 2026,
  },
  {
    id: 'zpl-rio-mente', name: 'Zona de Pesca Lúdica do Rio Mente', country: 'PT', kind: 'zpl', river: 'Rio Mente', place: 'Trás-os-Montes (troços definidos no edital)',
    notes: ['Edital de 2026.', 'Licenças especiais diárias com valores diferentes para pesca com e sem morte.'],
    source: { label: 'Edital 2026 (ICNF)', url: icnf('4916dbb535cf217e') }, docYear: 2026,
  },
  {
    id: 'zpl-rio-mouro', name: 'Zona de Pesca Lúdica do Rio Mouro', country: 'PT', kind: 'zpl', river: 'Rio Mouro', place: 'Alto Minho (troços definidos no edital)',
    notes: ['Edital de 2026.', 'Exemplo de preços: 1,00 €/dia com morte e 0,50 €/dia sem morte em alguns troços.'],
    source: { label: 'Edital 2026 (ICNF)', url: icnf('8fd4c86a7d1d7a57') }, docYear: 2026,
  },
  {
    id: 'zpl-castro-laboreiro', name: 'Zona de Pesca Lúdica do Rio Castro Laboreiro e Corga da Varziela', country: 'PT', kind: 'zpl', river: 'Rio Castro Laboreiro', place: 'Melgaço',
    notes: ['Edital de 2026.'],
    source: { label: 'Edital 2026 (ICNF)', url: icnf('5693ee97f258d764') }, docYear: 2026,
  },
  {
    id: 'zpr-serra-estrela', name: 'Zona de Pesca Reservada das Lagoas da Serra da Estrela', country: 'PT', kind: 'zpr', place: 'Serra da Estrela',
    notes: ['Edital de 2026.', 'Só pesca desportiva em provas, com autorização do ICNF pedida por clubes ou associações com pelo menos 50 dias de antecedência.', 'Exige licença especial diária coletiva.'],
    source: { label: 'Edital 2026 (ICNF)', url: icnf('aab940190a52c5e3') }, docYear: 2026,
  },
  {
    id: 'zpl-quinta-i', name: 'Zona de Pesca Lúdica da Albufeira da Quinta I', country: 'PT', kind: 'zpl', place: 'Beja', manager: 'MORAGRI – Sociedade Agrícola, S.A.',
    notes: ['Despacho de 30 de janeiro de 2026: concessão por 10 anos.', 'Taxa anual da concessão: 29,90 €/hectare.'],
    source: { label: 'Despacho 2026 (ICNF)', url: icnf('1635abf48234d84d') }, docYear: 2026,
  },
  {
    id: 'zpl-rio-alva', name: 'Zona de Pesca Lúdica do Rio Alva', country: 'PT', kind: 'zpl', river: 'Rio Alva', place: 'Troços definidos no edital',
    notes: ['Documento sem data confirmada; verificar edital em vigor.'],
    source: { label: 'Edital (ICNF)', url: icnf('9278b17ce4bbf86c') }, docYear: null,
  },
  {
    id: 'zpl-venda-velha', name: 'Zona de Pesca Lúdica da Albufeira de Venda Velha I', country: 'PT', kind: 'zpl', place: 'Albufeira da Venda Velha (ver no mapa)',
    notes: [
      'O edital fixa a pesca ao achigã de 1 de janeiro a 15 de março e de 15 de junho a 31 de dezembro, sem retenção de exemplares.',
      'Documento sem data confirmada.',
      'No mapa: associada à “Albufeira da Venda Velha” do OpenStreetMap pelo nome e pelo operador da barragem (Sociedade Agrícola de Rio Frio, segundo o OSM). O edital refere “Venda Velha I”.',
    ],
    source: { label: 'Edital (ICNF)', url: icnf('b7c3b135e09682b1') }, docYear: null, osmWater: ['relation/5366185'],
  },
  {
    id: 'zpl-rio-seco', name: 'Zona de Pesca Lúdica da Barragem do Rio Seco', country: 'PT', kind: 'zpl', place: 'Localização no edital',
    notes: ['Documento sem data confirmada; verificar edital em vigor.'],
    source: { label: 'Edital (ICNF)', url: icnf('954c344293e00289') }, docYear: null,
  },
  {
    id: 'conc-rio-cabril-lindoso', name: 'Concessão de Pesca no Rio Cabril (Albufeira do Alto Lindoso)', country: 'PT', kind: 'concessao', damId: 'alto-lindoso', river: 'Rio Cabril · Rio Lima', place: 'Alto Minho',
    notes: ['Licenças especiais diárias com valores diferentes para pescadores locais, do concelho e outros.', 'Pesca do nascer ao pôr do sol, apenas nas margens concessionadas.'],
    source: { label: 'Resumo do regulamento (ICNF)', url: icnf('8166230873d7a017') }, docYear: null,
  },
  {
    id: 'conc-touvedo', name: 'Concessão de Pesca da Albufeira do Touvedo', country: 'PT', kind: 'concessao', damId: 'touvedo', river: 'Rio Lima', place: 'Ponte da Barca',
    notes: ['Resumo com venda de licenças, períodos, dimensões, limites diários e horários.'],
    source: { label: 'Resumo do regulamento (ICNF)', url: icnf('40c9b9aad4d1b25d') }, docYear: null,
  },
  {
    id: 'conc-vilar', name: 'Concessão de Pesca da Albufeira do Vilar', country: 'PT', kind: 'concessao', damId: 'vilar', river: 'Rio Távora', place: 'Moimenta da Beira · Sernancelhe',
    notes: ['Exige licença nacional ou regional válida e documento de identificação para comprar a licença diária.'],
    source: { label: 'Resumo do regulamento (ICNF)', url: icnf('2c0ceb1d3c3a4da9') }, docYear: null,
  },
  {
    id: 'conc-belver', name: 'Concessão de Pesca da Albufeira de Belver', country: 'PT', kind: 'concessao', damId: 'belver', river: 'Rio Tejo', place: 'Gavião · Mação', manager: 'Associação de Caçadores de Ortiga (ponto de venda)',
    notes: ['Edital para 2022 e anos seguintes.'],
    source: { label: 'Locais de venda (ICNF)', url: icnf('60073e920dc103d2') }, docYear: 2022,
  },
  {
    id: 'conc-unhais', name: 'Concessão de Pesca no Rio Unhais (troço superior e Albufeira de Santa Luzia)', country: 'PT', kind: 'concessao', damId: 'santa-luzia', river: 'Rio Unhais', place: 'Pampilhosa da Serra', manager: 'Município de Pampilhosa da Serra',
    notes: ['Concessão gerida pelo município.'],
    source: { label: 'Resumo do regulamento (ICNF)', url: icnf('3f044a3d3f36640a') }, docYear: null,
  },
  {
    id: 'conc-coa-sabugal', name: 'Concessão de Pesca no Rio Côa — Sabugal', country: 'PT', kind: 'concessao', damId: 'sabugal', river: 'Rio Côa', place: 'Sabugal',
    notes: ['Resumo do regulamento disponível no ICNF.'],
    source: { label: 'Resumo do regulamento (ICNF)', url: icnf('0d36614a4515e24e') }, docYear: null,
  },
  {
    id: 'conc-apartadura', name: 'Concessão de Pesca da Albufeira da Apartadura', country: 'PT', kind: 'concessao', damId: 'apartadura', place: 'Marvão', manager: 'Associação de Caça e Pesca de São Salvador da Aramenha',
    notes: ['Proibidas embarcações a motor e engodo orgânico.'],
    source: { label: 'Resumo do regulamento (ICNF)', url: icnf('9f0dac1ee791e675') }, docYear: null,
  },
  {
    id: 'conc-foro-espanhol', name: 'Concessão de Pesca da Albufeira do Foro do Espanhol', country: 'PT', kind: 'concessao', damId: 'foro-do-espanhol', place: 'Alandroal', manager: 'Grupo Desportivo de Caça e Pesca do Seixo',
    notes: ['Resumo do regulamento disponível no ICNF.'],
    source: { label: 'Resumo do regulamento (ICNF)', url: icnf('de3ca25c39678330') }, docYear: null,
  },
  {
    id: 'conc-misericordia', name: 'Concessão de Pesca da Albufeira da Misericórdia', country: 'PT', kind: 'concessao', damId: 'misericordia', place: 'Beja', manager: 'Clube de Caça e Pesca de Santa Clara de Louredo',
    notes: ['Documento com locais e horários de venda das licenças.'],
    source: { label: 'Locais de venda (ICNF)', url: icnf('468d5fa238179f95') }, docYear: null,
  },
  {
    id: 'conc-vale-cobrao', name: 'Concessão de Pesca da Albufeira do Vale Cobrão', country: 'PT', kind: 'concessao', place: 'Albufeira de Vale do Cobrão (ver no mapa)',
    notes: ['Resumo do regulamento disponível no ICNF.', 'No mapa: associada pelo nome à “Albufeira de Vale do Cobrão” do OpenStreetMap (barragem gerida pela Companhia das Lezírias, segundo o OSM).'],
    source: { label: 'Resumo do regulamento (ICNF)', url: icnf('a8a4044c58a35d81') }, docYear: null, osmWater: ['way/132800346'],
  },
  {
    id: 'conc-corte-pereiro', name: 'Concessão de Pesca da Albufeira 2 de Corte Pereiro', country: 'PT', kind: 'concessao', place: 'Localização no regulamento',
    notes: ['Resumo do regulamento disponível no ICNF.'],
    source: { label: 'Resumo do regulamento (ICNF)', url: icnf('6c706e7f1df2b688') }, docYear: null,
  },
  {
    id: 'conc-bouca-cova', name: 'Concessão de Pesca da Albufeira da Bouça Cova', country: 'PT', kind: 'concessao', place: 'Albufeira de Bouça Cova (ver no mapa)',
    notes: ['Resumo do regulamento disponível no ICNF.', 'No mapa: associada pelo nome à “Albufeira de Bouça Cova” do OpenStreetMap (barragem gerida pela DRAPC, segundo o OSM).'],
    source: { label: 'Resumo do regulamento (ICNF)', url: icnf('3b229f8548f951f0') }, docYear: null, osmWater: ['relation/4007088'],
  },
  {
    id: 'conc-azinhal', name: 'Concessão de Pesca na Albufeira Norte da Herdade do Azinhal', country: 'PT', kind: 'concessao', place: 'Localização no documento', manager: 'Clube Desportivo de S. Matias',
    notes: ['Documento antigo (concessão por 10 anos): pode já não estar em vigor.'],
    source: { label: 'Documento (ICNF)', url: icnf('4e980306489bec4d') }, docYear: null,
  },
  {
    id: 'conc-coutada-rodao', name: 'Concessão de Pesca Desportiva da Barragem da Coutada (Tamujais)', country: 'PT', kind: 'concessao', place: 'Perais e Sarnadas de Ródão · Vila Velha de Ródão', manager: 'Câmara Municipal de Vila Velha de Ródão',
    notes: [
      'Aviso n.º 12482/2012, Diário da República de 18 de setembro de 2012.',
      'Segundo o resumo do aviso obtido por pesquisa: cerca de 48,63 ha; só pesca desportiva; sem redes nem embarcações a motor; licenças diárias nos serviços da câmara.',
      'Não foi possível abrir o documento original a partir daqui. Documento de 2012: confirme se a concessão continua em vigor.',
      'No mapa: albufeira da “Barragem da Coutada” do OpenStreetMap, junto a Perais (a albufeira não tem nome próprio no OSM).',
    ],
    source: { label: 'Aviso 12482/2012 (Diário da República)', url: 'https://dre.pt/home/-/dre/1314390/details/maximized' }, docYear: 2012, osmWater: ['way/194995899'],
  },
  {
    id: 'ref-herdade-urgueira', name: 'Herdade da Urgueira — barragens com concessão de pesca (referida em notícia)', country: 'PT', kind: 'concessao', place: 'Perais · Vila Velha de Ródão', evidence: 'noticia',
    notes: [
      'Uma notícia regional refere que a herdade “dispõe de duas barragens com concessão para o desporto”.',
      'Não foi encontrado edital nem despacho do ICNF: não se sabe quais são as albufeiras, quem é o concessionário nem se a concessão está em vigor.',
      'Sem localização no mapa: os dados cartográficos não identificam as barragens da herdade.',
    ],
    source: { label: 'Diário Digital Castelo Branco (notícia)', url: 'https://www.diariodigitalcastelobranco.pt/noticia/34559/vila-velha-de-rodao-herdade-da-urgueira-recebeu-mesquita-nunes' }, docYear: null,
  },
  {
    id: 'coto-santa-ana', name: 'Coto deportivo de pesca — Embalse de Santa Ana', country: 'ES', kind: 'coto', damId: 'santa-ana', river: 'Rio Noguera Ribagorzana', place: 'Huesca · Lleida', manager: 'Federación Aragonesa de Pesca y Casting',
    notes: ['Plano anual de aproveitamento 2026.', 'Inclui black bass e carpa em regime extrativo, com captura e solta voluntária.', 'Troço junto à barragem de Canelles vedado de janeiro a junho.'],
    source: { label: 'Plano anual 2026 (FAPYC)', url: 'https://intranet.fapyc.es/index.php?ctl=paa_paa&idCoto=9&year=2026' }, docYear: 2026,
  },
  {
    id: 'cotos-la-rioja', name: 'Cotos de pesca intensiva — La Rioja', country: 'ES', kind: 'coto', place: 'La Rioja (ex.: embalse de La Grajera)', manager: 'Gobierno de La Rioja',
    notes: ['Página oficial com os cotos intensivos da comunidade.', 'Verifique os períodos da época em curso: os publicados podem já ter terminado.'],
    source: { label: 'Gobierno de La Rioja', url: 'https://www.larioja.org/medio-ambiente/es/caza-pesca/pesca-rioja/cotos-pesca-intensiva' }, docYear: 2026,
  },
]

export const ZONE_KIND: Record<FishingZone['kind'], string> = {
  concessao: 'Concessão de pesca',
  zpl: 'Zona de pesca lúdica',
  zpr: 'Zona de pesca reservada',
  coto: 'Coto de pesca',
}
