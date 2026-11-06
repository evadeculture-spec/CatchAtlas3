import type { CountryId } from './types'

// Informação legal compilada a 31/10/2026 a partir das fontes indicadas.
// Não substitui os diplomas, editais e ordens de pesca em vigor.
export const LEGAL_CHECKED_AT = '2026-10-31'

export interface Source {
  label: string
  url: string
}
export type Confidence = 'oficial' | 'secundaria' | 'a-confirmar'

export interface LegalItem {
  title: string
  text: string
  confidence: Confidence
  sources: Source[]
}

export interface LegalSection {
  id: string
  title: string
  items: LegalItem[]
}

const dre = (path: string) => `https://diariodarepublica.pt/dr/${path}`

export const LEGAL: Record<CountryId, LegalSection[]> = {
  PT: [
    {
      id: 'diplomas',
      title: 'Enquadramento legal',
      items: [
        { title: 'Lei n.º 7/2008 — Lei da Pesca nas Águas Interiores', text: 'Base legal da pesca e aquicultura em todas as águas interiores superficiais, públicas ou particulares. Alterada e republicada pelo Decreto-Lei n.º 221/2015.', confidence: 'oficial', sources: [{ label: 'Diário da República', url: dre('detalhe/lei/7-2008-247981') }] },
        { title: 'Decreto-Lei n.º 112/2017, de 6 de setembro', text: 'Regulamenta a Lei n.º 7/2008: espécies cuja pesca lúdica, desportiva e profissional é permitida, períodos de pesca e dimensões de captura.', confidence: 'oficial', sources: [{ label: 'Texto do diploma', url: 'https://dre.tretas.org/dre/3081133/decreto-lei-112-2017-de-6-de-setembro' }] },
        { title: 'Portaria n.º 360/2017, alterada pela Portaria n.º 108/2018', text: 'Condições de exercício da pesca: espécies, períodos, dimensões mínimas e regras para exemplares grandes de carpa e barbo no carp fishing noturno onde é permitido.', confidence: 'oficial', sources: [{ label: 'Texto consolidado (DR)', url: dre('legislacao-consolidada/portaria/2017-115146412-115137317') }, { label: 'Portaria 108/2018', url: 'http://lifesaramugo.lpn.pt/lifesaramugo.lpn.pt/files/files/8.Portaria%20n%C2%BA%20108-2018_10pg.pdf' }] },
        { title: 'Decreto-Lei n.º 92/2019 e Lei n.º 25/2023 — espécies exóticas', text: 'Regime das espécies exóticas e Lista Nacional de Espécies Invasoras. A Lei n.º 25/2023 colocou o achigã no regime de exceção (anexo III), ao lado da carpa e da truta-arco-íris, para a pesca lúdica e desportiva.', confidence: 'oficial', sources: [{ label: 'DL 92/2019 (consolidado)', url: dre('legislacao-consolidada/decreto-lei/2019-124568069') }, { label: 'Lei 25/2023', url: dre('detalhe/lei/25-2023-213706992') }] },
      ],
    },
    {
      id: 'licencas',
      title: 'Licenças',
      items: [
        { title: 'Licença de pesca lúdica e desportiva em águas interiores', text: 'Obrigatória. É anual, válida para o ano civil, e tem âmbito nacional, regional ou concelhio. É emitida pelo ICNF.', confidence: 'oficial', sources: [{ label: 'gov.pt', url: 'https://www.gov.pt/servicos/obter-licenca-de-pesca-desportiva-em-aguas-interiores' }] },
        { title: 'Onde obter', text: 'Licenças nacional e regional: rede Multibanco a partir de 1 de janeiro, ou no ICNF a partir de meados de dezembro do ano anterior. Licença concelhia: apenas no ICNF.', confidence: 'oficial', sources: [{ label: 'gov.pt', url: 'https://www.gov.pt/servicos/obter-licenca-de-pesca-desportiva-em-aguas-interiores' }] },
        { title: 'Valores', text: 'O gov.pt indica o valor como «sob consulta». Uma fonte não oficial e antiga indica 22,45 € (nacional) e 13,46 € (regional). Confirme o valor atual no ICNF ou no Multibanco.', confidence: 'a-confirmar', sources: [{ label: 'servicopublico.pt (não oficial)', url: 'https://www.servicopublico.pt/licenca-de-pesca/' }] },
        { title: 'Licenças especiais diárias', text: 'Concessões e zonas de pesca lúdica exigem, além da licença anual, uma licença especial diária com preço próprio. Exemplos de 2026: 0,50 € a 5 € por dia nos editais de zonas de pesca lúdica e 5,97 € nas zonas de pesca profissional do Mondego e do Lima.', confidence: 'oficial', sources: [{ label: 'Edital Rio Mouro 2026', url: 'https://www.icnf.pt/api/file/doc/8fd4c86a7d1d7a57' }, { label: 'Edital Baixo Mondego 2026', url: 'https://www.icnf.pt/api/file/doc/074dc0c524ad4e6b' }] },
        { title: 'Não confundir com a App RecFishing', text: 'O registo obrigatório de capturas na App RecFishing (desde fevereiro de 2026) aplica-se à pesca marítima recreativa de espécies como robalo e atum-rabilho, não às águas interiores sob o ICNF.', confidence: 'oficial', sources: [{ label: 'FAQ DGRM 2026', url: 'https://www.dgrm.pt/documents/20143/121101/FAQ-Pesca+Ludica+2026_mar%C3%A7o.pdf/97f086cc-b771-9ca7-4bd1-746e0740611b' }] },
      ],
    },
    {
      id: 'regras',
      title: 'Regras principais',
      items: [
        { title: 'Períodos de pesca', text: 'Barbos, bogas, bordalo, escalos e ruivaco: 1 de janeiro a 15 de março e 15 de junho a 31 de dezembro. Achigã em massas de água lênticas: 1 de janeiro a 15 de março e 15 de maio a 31 de dezembro. Na sub-bacia da ribeira do Vascão o achigã pode ser pescado todo o ano. Editais locais podem fixar períodos diferentes.', confidence: 'oficial', sources: [{ label: 'Portaria 360/2017 (consolidada)', url: dre('legislacao-consolidada/portaria/2017-115146412-115137317') }] },
        { title: 'Dimensões mínimas', text: 'O artigo 11.º fixa 20 cm para achigã em águas lênticas, barbos e truta-de-rio, com exceções (por exemplo, no Vascão o achigã não tem dimensão mínima). Outras espécies permitidas podem não ter dimensão mínima. Confirme no texto consolidado.', confidence: 'oficial', sources: [{ label: 'Portaria 360/2017, art. 11.º', url: dre('legislacao-consolidada/portaria/2017-115146412-115137317') }] },
        { title: 'Siluro e lucioperca', text: 'Fontes secundárias indicam que é proibido devolver à água ou transportar vivos exemplares destas espécies exóticas. Não foi possível confirmar no texto legal: verifique o DL 92/2019 e o edital local.', confidence: 'secundaria', sources: [{ label: 'Wilder (lucioperca)', url: 'https://wilder.pt/naturalistas/lucioperca-este-predador-veio-de-franca-e-rapidamente-invadiu-portugal' }, { label: 'Guia Rural (siluro)', url: 'https://guiarural.pt/index.php/page/o-que-e-o-siluro.html' }] },
        { title: 'Número de canas, iscos e pesca noturna', text: 'Não incluídos nesta compilação: dependem da portaria e do edital de cada zona. Consulte sempre o documento da massa de água.', confidence: 'a-confirmar', sources: [] },
      ],
    },
    {
      id: 'zonas',
      title: 'Tipos de águas',
      items: [
        { title: 'Águas livres, zonas de pesca reservada e concessões', text: 'As águas interiores classificam-se em águas livres, zonas de pesca reservada (regulamento próprio) e concessões de pesca, atribuídas a clubes, associações, municípios ou entidades privadas por um período máximo de 10 anos, com direito exclusivo de exploração da pesca.', confidence: 'oficial', sources: [{ label: 'ICNF (DL 112/2017)', url: 'https://www.icnf.pt/api/file/doc/4c2dd8dcfed6bc38' }] },
        { title: 'Lista completa de concessões', text: 'O ICNF publica as camadas «Concessões de pesca» (versão de setembro de 2022) e «Zonas de pesca reservada» no seu geocatálogo, em formato de mapa. A app inclui apenas as concessões com documento identificado.', confidence: 'oficial', sources: [{ label: 'geoCatálogo ICNF', url: 'https://geocatalogo.icnf.pt/catalogo_tema4.html' }] },
      ],
    },
  ],
  ES: [
    {
      id: 'diplomas',
      title: 'Enquadramento legal',
      items: [
        { title: 'Competência das comunidades autónomas', text: 'A pesca em águas continentais é regulada por cada comunidade autónoma, através de leis próprias e de uma ordem de pesca anual (vedas, tamanhos, cupos, cotos e espécies).', confidence: 'secundaria', sources: [{ label: 'Guía de Pesca 2026', url: 'https://guiadepesca.es/guia-pesca-2026' }] },
        { title: 'Ley 42/2007 e Real Decreto 630/2013 — espécies exóticas invasoras', text: 'Catálogo Español de Especies Exóticas Invasoras. Após a sentença do Tribunal Supremo 637/2016, lúcio, lucioperca, black bass, alburno e truta-arco-íris ficaram incluídos no catálogo. As regras de pesca destas espécies variam por comunidade.', confidence: 'secundaria', sources: [{ label: 'aipeces.com', url: 'https://www.aipeces.com/blog/especies-invasoras-y-autoctonas' }, { label: 'Invasara (Aragão)', url: 'https://www.invasara.es/normativa_y_especies_piscicolas_invasoras/' }] },
      ],
    },
    {
      id: 'licencas',
      title: 'Licenças',
      items: [
        { title: 'Licença interautonómica de pesca', text: '25 € por ano. Convénio publicado a 26 de fevereiro de 2026 (BOE-A-2026-5597) entre Andaluzia, Aragão, Castela-La Mancha, Castela e Leão, Madrid, Comunidade Valenciana, Estremadura, Galiza, Astúrias e Múrcia. Não abrange Catalunha, País Basco, Navarra, La Rioja, Cantábria, Baleares nem Canárias.', confidence: 'oficial', sources: [{ label: 'BOE-A-2026-5597', url: 'https://www.boe.es/diario_boe/txt.php?id=BOE-A-2026-5597' }] },
        { title: 'Licenças autonómicas (valores indicativos)', text: 'Estremadura: 5,10 €/ano. Andaluzia: 7,98 € a 8,14 €/ano (fontes divergem). Galiza: 20,35 €/ano segundo uma guia, valor contraditório noutras. Catalunha: 7,98 €/ano (não confirmado). Castela-La Mancha: 8,88 € para não residentes (não confirmado). Confirme na sede eletrónica de cada comunidade.', confidence: 'a-confirmar', sources: [{ label: 'Junta de Andalucía (tasas)', url: 'https://www.juntadeandalucia.es/medioambiente/portal/landing-page-%C3%ADndice/-/asset_publisher/zX2ouZa4r1Rf/content/tasas-y-precios-p%C3%BAblicos-de-pesca/20151' }, { label: 'guiadepesca.es (não oficial)', url: 'https://guiadepesca.es/normativa/licencias' }] },
        { title: 'Cotos', text: 'Cotos deportivos e intensivos exigem, além da licença, uma autorização ou permissão própria, segundo o plano de cada coto.', confidence: 'secundaria', sources: [{ label: 'Plano 2026 — Santa Ana (FAPYC)', url: 'https://intranet.fapyc.es/index.php?ctl=paa_paa&idCoto=9&year=2026' }] },
      ],
    },
    {
      id: 'regras',
      title: 'Regras principais',
      items: [
        { title: 'Espécies invasoras: devolução', text: 'Em Castela e Leão as espécies invasoras podem ser capturadas mas não devolvidas vivas, exceto carpa e black bass nas massas de água onde já existiam antes da Ley 42/2007. Noutras comunidades as regras diferem: consulte a ordem de pesca.', confidence: 'secundaria', sources: [{ label: 'Normativa Castilla y León (resumo)', url: 'https://myfishingmaps.com/normativa-de-pesca/resumen-la-normativa-pesca-castilla-leon/' }] },
        { title: 'Siluro', text: 'Em Castela e Leão não pode ser libertado depois de capturado. Confirme a regra na comunidade onde pesca.', confidence: 'secundaria', sources: [{ label: 'Diario de Valladolid', url: 'https://www.diariodevalladolid.es/castilla-y-leon/260707/284543/debes-pescas-siluro-normativa-desconocen.html' }] },
        { title: 'Aragão: iscos', text: 'A ordem de pesca proíbe usar exemplares de espécies invasoras como isco, vivo ou morto.', confidence: 'secundaria', sources: [{ label: 'Invasara (Aragão)', url: 'https://www.invasara.es/normativa_y_especies_piscicolas_invasoras/' }] },
        { title: 'Tamanhos, vedas e cupos', text: 'Variam por comunidade e por massa de água. As fontes consultadas contradizem-se (por exemplo, sobre o tamanho mínimo do black bass), por isso não são indicados aqui.', confidence: 'a-confirmar', sources: [] },
      ],
    },
  ],
}

export const CONFIDENCE_LABEL: Record<Confidence, string> = {
  oficial: 'Fonte oficial',
  secundaria: 'Fonte secundária',
  'a-confirmar': 'A confirmar',
}
