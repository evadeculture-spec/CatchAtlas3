// Regressões da regra de classificação «Carpa». DADOS SINTÉTICOS (identificados como tal): reproduzem os três
// casos documentais pedidos (Aguieira com setores e modalidades distintas; documento da Extremadura sobre achigã;
// regra com termo em dezembro de 2026), sem afirmar o regime real de nenhuma água.
import { describe, expect, it } from 'vitest'
import { classify, T, type CarpCatalog, type CarpConditions, type CarpRule, type CarpSector } from './model'

const C: CarpConditions = { licence: 'Licença de pesca desportiva', season: null, night: 'desconhecido', catchAndRelease: 'desconhecido', manager: null, hours: null, notes: null }
const sector = (key: string, waterKey: string): CarpSector => ({ key, waterKey, name: key, original: key, limitsText: null, a: null, b: null, point: null, precision: 'sem-coordenadas', provenance: [] })
const rule = (o: Partial<CarpRule> & Pick<CarpRule, 'key' | 'waterKey'>): CarpRule => ({
  sectorKey: null, species: ['carpa'], activity: 'pesca-individual', localActivity: null, effect: 'permitida', validFrom: null, validTo: '2027-12-31', conditions: C, sourceKey: 'icnf', concessionKey: null, provenance: [{ sheet: 'SINTÉTICO', row: 1 }], ...o,
})
const base = (): Pick<CarpCatalog, 'rules' | 'sources' | 'concessions' | 'evidence' | 'access'> => ({
  rules: [],
  sources: [
    { key: 'icnf', organism: 'ICNF (sintético)', url: null, ref: 'Edital sintético', lang: 'pt', competent: 'sim', verifiedAt: null },
    { key: 'clube', organism: 'Clube local (sintético)', url: null, ref: null, lang: 'pt', competent: 'nao', verifiedAt: null },
    { key: 'junta', organism: 'Junta de Extremadura (sintético)', url: null, ref: 'Orden sintética', lang: 'es', competent: 'sim', verifiedAt: '2026-10-01' },
  ],
  concessions: [],
  evidence: [{ key: 'e1', waterKey: 'aguieira', sectorKey: null, species: 'carpa', present: 'sim', sourceKey: 'icnf', observedAt: null, provenance: [] }],
  access: [],
})

describe('Aguieira (sintético): setores de margem e modalidades separados', () => {
  const cat = base()
  cat.rules = [
    rule({ key: 'r-noite', waterKey: 'aguieira', sectorKey: 'aguieira-s1', activity: 'carpfishing-noturno', localActivity: 'Carpfishing noturno', conditions: { ...C, night: 'sim', catchAndRelease: 'sim' } }),
    rule({ key: 'r-provas', waterKey: 'aguieira', sectorKey: 'aguieira-s2', activity: 'provas', localActivity: 'Provas organizadas', conditions: { ...C, manager: 'Federação (sintético)' } }),
    rule({ key: 'r-ind', waterKey: 'aguieira', sectorKey: 'aguieira-s2', activity: 'pesca-individual' }),
  ]
  const s1 = sector('aguieira-s1', 'aguieira'), s2 = sector('aguieira-s2', 'aguieira')
  it('setor 1, carpfishing noturno: permitida, com pesca noturna e devolução documentadas', () => {
    const c = classify(cat, 'aguieira', s1, '2026-11-20', 'carpfishing-noturno')
    expect(c.permission.state).toBe('permitida')
    expect(c.permission.conditions?.night).toBe('sim')
    expect(c.permission.conditions?.catchAndRelease).toBe('sim')
  })
  it('setor 1, pesca individual: a regra do carpfishing noturno não a autoriza', () => {
    const c = classify(cat, 'aguieira', s1, '2026-11-20', 'pesca-individual')
    expect(c.permission.state).toBe('por-confirmar')
    expect(c.permission.reasons.map((r) => r.code)).toContain('outra-modalidade')
  })
  it('setor 2: provas organizadas e pesca individual são decisões distintas; nenhuma passa para o setor 1', () => {
    expect(classify(cat, 'aguieira', s2, '2026-11-20', 'provas').permission.rules.map((r) => r.key)).toEqual(['r-provas'])
    expect(classify(cat, 'aguieira', s2, '2026-11-20', 'pesca-individual').permission.rules.map((r) => r.key)).toEqual(['r-ind'])
    expect(classify(cat, 'aguieira', s2, '2026-11-20', 'carpfishing-noturno').permission.state).toBe('por-confirmar')
    expect(classify(cat, 'aguieira', s1, '2026-11-20', 'provas').permission.state).toBe('por-confirmar')
  })
  it('presença, permissão e acesso são independentes', () => {
    const c = classify(cat, 'aguieira', s1, '2026-11-20', 'carpfishing-noturno')
    expect(c.presence.state).toBe('documentada')
    expect(c.access.state).toBe('desconhecido')
  })
})

describe('Extremadura (sintético): documento sobre achigã não comprova permissão para carpa', () => {
  const cat = base()
  cat.rules = [rule({ key: 'r-achiga', waterKey: 'ext', species: ['achigã', 'black-bass'], sourceKey: 'junta' })]
  it('carpa: por confirmar, com a razão «outra espécie»', () => {
    const c = classify(cat, 'ext', null, '2026-11-20', 'pesca-individual')
    expect(c.permission.state).toBe('por-confirmar')
    expect(T.pt.reason(c.permission.reasons[0])).toBe('O documento cobre achigã, black-bass, não a carpa.')
    expect(T.es.reason(c.permission.reasons[0])).toBe('El documento se refiere a achigã, black-bass, no a la carpa.')
  })
})

describe('Vigência: regra que termina em dezembro de 2026', () => {
  const cat = base()
  cat.rules = [rule({ key: 'r-2026', waterKey: 'w', validFrom: '2026-01-01', validTo: '2026-12-31' })]
  it('31 dez 2026 (último dia, inclusivo): permitida', () => {
    expect(classify(cat, 'w', null, '2026-12-31', 'pesca-individual').permission.state).toBe('permitida')
  })
  it('jornada de janeiro de 2027: deixa de sustentar a confirmação', () => {
    const c = classify(cat, 'w', null, '2027-01-15', 'pesca-individual')
    expect(c.permission.state).toBe('por-confirmar')
    expect(T.pt.reason(c.permission.reasons[0])).toBe('A regra terminou em 31 de dezembro de 2026.')
    expect(T.es.reason(c.permission.reasons[0])).toContain('31 de diciembre de 2026')
  })
  it('antes do início: ainda não vigente', () => {
    expect(classify(cat, 'w', null, '2025-12-31', 'pesca-individual').permission.reasons[0].code).toBe('ainda-nao-vigente')
  })
})

describe('Outras regras de decisão', () => {
  it('regra sem termo expresso: só confirma com verificação independente (a importação não conta)', () => {
    const cat = base()
    cat.rules = [rule({ key: 'r', waterKey: 'w', validTo: null })]
    expect(classify(cat, 'w', null, '2026-11-20', 'pesca-individual').permission.reasons[0].code).toBe('sem-termo-sem-verificacao')
    cat.rules = [rule({ key: 'r', waterKey: 'w', validTo: null, sourceKey: 'junta' })]
    expect(classify(cat, 'w', null, '2026-11-20', 'pesca-individual').permission.state).toBe('permitida')
  })
  it('fonte não competente não autoriza', () => {
    const cat = base()
    cat.rules = [rule({ key: 'r', waterKey: 'w', sourceKey: 'clube' })]
    expect(classify(cat, 'w', null, '2026-11-20', 'pesca-individual').permission.reasons[0].code).toBe('fonte-nao-competente')
  })
  it('proibição expressa tem estado próprio', () => {
    const cat = base()
    cat.rules = [rule({ key: 'r', waterKey: 'w', effect: 'proibida' })]
    expect(classify(cat, 'w', null, '2026-11-20', 'pesca-individual').permission.state).toBe('proibida')
  })
  it('conflito ao mesmo nível: por confirmar; proibição do setor prevalece sobre permissão da água', () => {
    const cat = base()
    cat.rules = [rule({ key: 'ok', waterKey: 'w' }), rule({ key: 'ban', waterKey: 'w', effect: 'proibida' })]
    expect(classify(cat, 'w', null, '2026-11-20', 'pesca-individual').permission.reasons.map((r) => r.code)).toContain('conflito')
    cat.rules = [rule({ key: 'ok', waterKey: 'w' }), rule({ key: 'ban', waterKey: 'w', sectorKey: 's', effect: 'proibida' })]
    expect(classify(cat, 'w', sector('s', 'w'), '2026-11-20', 'pesca-individual').permission.state).toBe('proibida')
  })
  it('concessão extinta invalida o título anterior', () => {
    const cat = base()
    cat.concessions = [{ key: 'c', waterKey: 'w', name: 'Concessão sintética', status: 'extinta', validTo: '2025-06-30', sourceKey: 'icnf', provenance: [] }]
    cat.rules = [rule({ key: 'r', waterKey: 'w', concessionKey: 'c' })]
    const c = classify(cat, 'w', null, '2026-11-20', 'pesca-individual')
    expect(c.permission.state).toBe('por-confirmar')
    expect(c.permission.reasons[0].code).toBe('concessao-extinta')
  })
  it('sem regra nenhuma: por confirmar; desconhecido não é «não»', () => {
    const c = classify(base(), 'nada', null, '2026-11-20', 'pesca-individual')
    expect(c.permission.state).toBe('por-confirmar')
    expect(c.presence.state).toBe('desconhecida')
  })
})
