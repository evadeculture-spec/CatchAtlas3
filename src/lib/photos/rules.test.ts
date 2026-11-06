import { describe, expect, it } from 'vitest'
import type { PhotoAsset, PhotoCatalog } from '../../data/photos/types'
import { coverForDam, findDuplicateConflicts, isPublishable, observationsFor, photosForDam } from './rules'
import { evaluateLicense, scoreIdentity } from '../../../scripts/photos/pipeline'

const asset = (over: Partial<PhotoAsset> = {}): PhotoAsset => ({
  id: 'wmc-1',
  provider: 'wikimedia-commons',
  externalId: '1',
  title: 'File:Teste.jpg',
  sourcePageUrl: 'https://commons.wikimedia.org/wiki/File:Teste.jpg',
  originalFileUrl: 'https://upload.wikimedia.org/teste.jpg',
  author: 'Autor',
  authorUrl: null,
  license: { name: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0', requiresAttribution: true, shareAlike: true, commercialUse: true, derivatives: true },
  attribution: 'Autor, CC BY-SA 4.0, via Wikimedia Commons',
  changes: 'Redimensionada',
  width: 2000,
  height: 1333,
  capturedAt: null,
  collectedAt: '2026-11-01',
  checksumSha1: 'abc',
  location: null,
  locationEvidence: [],
  identity: 'confirmado',
  identityBasis: 'teste',
  identityMethod: 'humana',
  identityReviewer: 'Revisor',
  rights: 'aprovado',
  rightsBasis: 'teste',
  publication: 'publicado',
  exportAllowed: true,
  variants: [{ width: 1280, height: 853, format: 'jpeg', src: '/photos/orellana/wmc-1-1280.jpg' }],
  alt: 'Teste',
  ...over,
})

const catalog = (assets: PhotoAsset[], links: PhotoCatalog['links'], extra: Partial<PhotoCatalog> = {}): PhotoCatalog => ({
  generatedAt: null,
  assets,
  links,
  observations: [],
  adjacentPairs: [],
  ...extra,
})
const link = (assetId: string, damId: string, role: 'capa' | 'margens' = 'capa') => ({
  assetId,
  damId,
  role,
  order: 0,
  basis: '',
  focal: { mobile: { x: 0.5, y: 0.5 }, desktop: { x: 0.5, y: 0.5 } },
})

describe('publicação', () => {
  it('publica só com identidade, direitos e publicação aprovados', () => {
    expect(isPublishable(asset())).toBe(true)
    expect(isPublishable(asset({ identity: 'candidato' }))).toBe(false)
    expect(isPublishable(asset({ identity: 'revisao' }))).toBe(false)
    expect(isPublishable(asset({ rights: 'por-verificar' }))).toBe(false)
    expect(isPublishable(asset({ publication: 'rascunho' }))).toBe(false)
    expect(isPublishable(asset({ variants: [] }))).toBe(false)
  })

  it('a capa aprovada aparece na barragem certa e não noutra', () => {
    const c = catalog([asset()], [link('wmc-1', 'orellana')])
    expect(coverForDam(c, 'orellana')?.asset.id).toBe('wmc-1')
    expect(coverForDam(c, 'alqueva')).toBeNull()
  })

  it('ignora variantes com URL externo ou inválido (fallback)', () => {
    const bad = asset({ variants: [{ width: 1280, height: 853, format: 'jpeg', src: 'https://exemplo.com/x.jpg' }] })
    expect(photosForDam(catalog([bad], [link('wmc-1', 'orellana')]), 'orellana')).toHaveLength(0)
    expect(photosForDam(catalog([], [link('em-falta', 'orellana')]), 'orellana')).toHaveLength(0)
  })
})

describe('duplicados', () => {
  it('assinala a mesma imagem em albufeiras incompatíveis', () => {
    const c = catalog([asset({ id: 'a' }), asset({ id: 'b' })], [link('a', 'orellana'), link('b', 'alqueva')])
    expect(findDuplicateConflicts(c)).toHaveLength(1)
  })
  it('aceita a mesma imagem em albufeiras declaradas adjacentes', () => {
    const c = catalog([asset({ id: 'a' }), asset({ id: 'b' })], [link('a', 'cabril'), link('b', 'bouca')], { adjacentPairs: [['cabril', 'bouca']] })
    expect(findDuplicateConflicts(c)).toHaveLength(0)
  })
})

describe('observações', () => {
  it('só acompanham a fotografia exata (id e checksum) e se estiverem aprovadas', () => {
    const a = asset()
    const base = { layer: 'observado' as const, category: 'rocha' as const, text: 'Rocha exposta junto à água', region: null, origin: 'manual' as const, confidence: 'media' as const, limitations: '', analysisVersion: '1', model: null, analyzedAt: '2026-11-01' }
    const c = catalog([a], [link(a.id, 'orellana')], {
      observations: [
        { ...base, id: 'o1', assetId: a.id, assetChecksum: 'abc', review: 'aprovada' },
        { ...base, id: 'o2', assetId: a.id, assetChecksum: 'checksum-antigo', review: 'aprovada' },
        { ...base, id: 'o3', assetId: a.id, assetChecksum: 'abc', review: 'pendente' },
      ],
    })
    expect(observationsFor(c, a).map((o) => o.id)).toEqual(['o1'])
    expect(observationsFor(c, asset({ checksumSha1: 'nova-capa' }))).toHaveLength(0)
  })
})

describe('pipeline: licenças e identidade', () => {
  it('aceita CC0, domínio público, CC BY e CC BY-SA; recusa NC e ND', () => {
    expect(evaluateLicense('CC BY-SA 4.0').rights).toBe('compativel')
    expect(evaluateLicense('CC BY 2.0').rights).toBe('compativel')
    expect(evaluateLicense('CC0').rights).toBe('compativel')
    expect(evaluateLicense('Public domain').rights).toBe('compativel')
    expect(evaluateLicense('CC BY-NC-SA 2.0').rights).toBe('incompativel')
    expect(evaluateLicense('CC BY-ND 4.0').rights).toBe('incompativel')
    expect(evaluateLicense('').rights).toBe('desconhecido')
  })

  const orellana = { id: 'orellana', name: 'Orellana', approx: { lat: 39.0, lon: -5.45 }, river: 'Rio Guadiana', place: 'Orellana la Vieja' }
  it('dá prioridade ao nome com tipo de massa de água e coordenadas próximas', () => {
    const r = scoreIdentity(orellana, { title: 'File:Embalse de Orellana 2019.jpg', categories: ['Embalse de Orellana'], location: { lat: 39.02, lon: -5.5 } }, ['orellana', 'la serena'])
    expect(r.identity).toBe('candidato')
  })
  it('envia para revisão quando há homónimos ou coordenadas longe', () => {
    const far = scoreIdentity(orellana, { title: 'File:Orellana street.jpg', categories: [], location: { lat: 37.0, lon: -4.0 } }, ['orellana'])
    expect(far.identity).not.toBe('candidato')
    const mixed = scoreIdentity(orellana, { title: 'File:Embalse de Orellana y La Serena.jpg', categories: [], location: null }, ['orellana', 'la serena'])
    expect(mixed.identity).toBe('revisao')
  })
})

describe('fotografias do Unsplash', () => {
  const stock = (over: Partial<PhotoAsset> = {}) =>
    asset({
      id: 'unsplash-x',
      provider: 'unsplash',
      identity: 'ilustrativa',
      checksumSha1: 'unsplash:x',
      depicts: 'ilustrativa',
      variants: [{ width: 1280, height: 853, format: 'jpeg', src: 'https://images.unsplash.com/photo-123-abc?ixlib=rb-4.1.0&auto=format&fit=max&q=75&w=1280' }],
      ...over,
    })
  const link = (assetId: string) => ({ assetId, damId: 'orellana', role: 'capa' as const, order: 0, basis: '', focal: { mobile: { x: 0.5, y: 0.5 }, desktop: { x: 0.5, y: 0.5 } } })

  it('publica a capa ilustrativa servida pelo CDN do Unsplash', () => {
    expect(coverForDam(catalog([stock()], [link('unsplash-x')]), 'orellana')?.asset.id).toBe('unsplash-x')
  })
  it('recusa outros domínios externos', () => {
    const bad = stock({ variants: [{ width: 1280, height: 853, format: 'jpeg', src: 'https://exemplo.com/photo-1.jpg' }] })
    expect(coverForDam(catalog([bad], [link('unsplash-x')]), 'orellana')).toBeNull()
  })
  it('não aceita identidade "ilustrativa" fora do Unsplash', () => {
    expect(isPublishable(asset({ identity: 'ilustrativa' }))).toBe(false)
  })
  it('uma fotografia verificada substitui a do Unsplash', () => {
    const cat = catalog([asset(), stock()], [link('wmc-1'), link('unsplash-x')])
    expect(photosForDam(cat, 'orellana').map((p) => p.asset.id)).toEqual(['wmc-1'])
  })
})
