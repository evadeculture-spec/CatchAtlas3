import earcut from 'earcut'

/**
 * Malha das paredes da laje peninsular (puro: sem WebGL, testável).
 *
 * As coordenadas são Web Mercator normalizadas (0–1, y para sul), relativas a uma origem para
 * manter a precisão em float32. Cada aresta do contorno dá uma parede vertical (quad) com a sua
 * normal exterior e uma "sombra de contacto" no plano do fundo. A espessura (z) é aplicada no
 * shader, por isso a mesma malha serve para qualquer zoom.
 */

export type LngLat = [number, number]

/** Web Mercator normalizado (como MercatorCoordinate.fromLngLat, sem altitude). */
export function mercator([lng, lat]: LngLat): [number, number] {
  const x = (180 + lng) / 360
  const y = (180 - (180 / Math.PI) * Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360))) / 360
  return [x, y]
}

/** Área assinada em lng/lat (positiva = sentido anti-horário, com y para norte). */
export function signedArea(r: LngLat[]) {
  let a = 0
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += (r[j][0] - r[i][0]) * (r[j][1] + r[i][1])
  return a / 2
}

export interface WallEdge {
  /** Extremos em Mercator relativo à origem. */
  a: [number, number]
  b: [number, number]
  /** Normal exterior unitária no plano Mercator (aponta para fora da terra). */
  n: [number, number]
  /** Ponto médio (para ordenar e para a orientação face à câmara). */
  mid: [number, number]
  /** Aresta no limite norte/leste do recorte (face de corte). */
  cut: boolean
}

export interface SlabMesh {
  origin: [number, number]
  edges: WallEdge[]
  /** Vértices intercalados: x, y, t, nx, ny, kind (6 floats). 4 por aresta de parede + 4 por sombra. */
  vertices: Float32Array
  /** Índices da sombra de contacto (todas as arestas), desenhados antes das paredes. */
  shadowIndices: Uint32Array
  /** Triângulos do topo da laje (z = 0): só escrevem profundidade, para as paredes de trás ficarem ocultas. */
  topIndices: Uint32Array
  /** Primeiro vértice da parede da aresta i = i * 4; sombra = (edges.length + i) * 4. */
  wallBase: (i: number) => number
}

export const FLOATS_PER_VERTEX = 6
/** kind: 0 parede de costa, 1 face de corte, 2 sombra de contacto, 3 topo (só profundidade). */
export const KIND = { wall: 0, cut: 1, shadow: 2, top: 3 } as const

/**
 * Constrói a malha a partir dos anéis do polígono da laje (lng/lat, GeoJSON).
 * `isCut(a, b)` identifica as arestas sobre o limite do recorte.
 */
export function buildSlabMesh(rings: LngLat[][], isCut: (a: LngLat, b: LngLat) => boolean): SlabMesh {
  // Origem: centro da extensão (Mercator), para coordenadas pequenas em float32.
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const r of rings) for (const p of r) {
    const [x, y] = mercator(p)
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }
  const origin: [number, number] = [(minX + maxX) / 2, (minY + maxY) / 2]
  const edges: WallEdge[] = []
  rings.forEach((ring, ri) => {
    // Exterior no sentido anti-horário, buracos no horário: a normal (dy, -dx) aponta sempre para fora da terra.
    const r = (ri === 0) === signedArea(ring) > 0 ? ring : [...ring].reverse()
    for (let i = 1; i < r.length; i++) {
      const p0 = r[i - 1], p1 = r[i]
      if (p0[0] === p1[0] && p0[1] === p1[1]) continue
      const m0 = mercator(p0), m1 = mercator(p1)
      const a: [number, number] = [m0[0] - origin[0], m0[1] - origin[1]]
      const b: [number, number] = [m1[0] - origin[0], m1[1] - origin[1]]
      // Em lng/lat (y para norte) a normal exterior é (dy, -dx); em Mercator o y aponta para sul.
      const dx = p1[0] - p0[0], dy = p1[1] - p0[1]
      let nx = dy, ny = dx
      const len = Math.hypot(nx, ny) || 1
      nx /= len
      ny /= len
      edges.push({ a, b, n: [nx, ny], mid: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], cut: isCut(p0, p1) })
    }
  })
  // Topo: triangulação do polígono (com buracos) em Mercator relativo.
  const flat: number[] = []
  const holes: number[] = []
  rings.forEach((ring, ri) => {
    if (ri > 0) holes.push(flat.length / 2)
    const r = ring[0][0] === ring[ring.length - 1][0] && ring[0][1] === ring[ring.length - 1][1] ? ring.slice(0, -1) : ring
    for (const p of r) {
      const [x, y] = mercator(p)
      flat.push(x - origin[0], y - origin[1])
    }
  })
  const tri = earcut(flat, holes.length ? holes : undefined, 2)
  const topCount = flat.length / 2
  const vertices = new Float32Array((edges.length * 8 + topCount) * FLOATS_PER_VERTEX)
  let o = 0
  const put = (x: number, y: number, t: number, nx: number, ny: number, kind: number) => {
    vertices[o++] = x
    vertices[o++] = y
    vertices[o++] = t
    vertices[o++] = nx
    vertices[o++] = ny
    vertices[o++] = kind
  }
  // Paredes: topo (t=0) e base (t=1) de cada extremo.
  for (const e of edges) {
    const k = e.cut ? KIND.cut : KIND.wall
    put(e.a[0], e.a[1], 0, e.n[0], e.n[1], k)
    put(e.b[0], e.b[1], 0, e.n[0], e.n[1], k)
    put(e.b[0], e.b[1], 1, e.n[0], e.n[1], k)
    put(e.a[0], e.a[1], 1, e.n[0], e.n[1], k)
  }
  // Sombra de contacto no fundo: da base da parede (t=0) para fora (t=1).
  for (const e of edges) {
    put(e.a[0], e.a[1], 0, e.n[0], e.n[1], KIND.shadow)
    put(e.b[0], e.b[1], 0, e.n[0], e.n[1], KIND.shadow)
    put(e.b[0], e.b[1], 1, e.n[0], e.n[1], KIND.shadow)
    put(e.a[0], e.a[1], 1, e.n[0], e.n[1], KIND.shadow)
  }
  const topBase = edges.length * 8
  for (let i = 0; i < topCount; i++) put(flat[i * 2], flat[i * 2 + 1], 0, 0, 0, KIND.top)
  const topIndices = Uint32Array.from(tri, (v) => v + topBase)
  const shadowIndices = new Uint32Array(edges.length * 6)
  for (let i = 0; i < edges.length; i++) {
    const v = (edges.length + i) * 4
    shadowIndices.set([v, v + 1, v + 2, v, v + 2, v + 3], i * 6)
  }
  return { origin, edges, vertices, shadowIndices, topIndices, wallBase: (i) => i * 4 }
}

/**
 * Paredes voltadas para a câmara, da mais distante para a mais próxima (algoritmo do pintor).
 * `eye` é a posição horizontal da câmara em Mercator relativo à origem. As paredes de trás ficam
 * escondidas pela própria terra (camada opaca por cima), mas descartá-las poupa trabalho.
 */
export function visibleWallIndices(mesh: SlabMesh, eye: [number, number], out?: Uint32Array): Uint32Array {
  const vis: { i: number; d: number }[] = []
  mesh.edges.forEach((e, i) => {
    const vx = eye[0] - e.mid[0], vy = eye[1] - e.mid[1]
    if (vx * e.n[0] + vy * e.n[1] > 0) vis.push({ i, d: vx * vx + vy * vy })
  })
  vis.sort((p, q) => q.d - p.d)
  const idx = out && out.length >= vis.length * 6 ? out : new Uint32Array(vis.length * 6)
  vis.forEach(({ i }, k) => {
    const v = mesh.wallBase(i)
    idx[k * 6] = v
    idx[k * 6 + 1] = v + 1
    idx[k * 6 + 2] = v + 2
    idx[k * 6 + 3] = v
    idx[k * 6 + 4] = v + 2
    idx[k * 6 + 5] = v + 3
  })
  return idx.subarray(0, vis.length * 6)
}

/** Posição da câmara (homogénea → cartesiana) a partir da inversa da matriz modelo-vista-projeção. */
export function eyeFromMatrix(m: ArrayLike<number>): [number, number, number] | null {
  const inv = invert4(m)
  if (!inv) return null
  // O centro da câmara projeta-se em (0, 0, c, 0): é a terceira coluna da inversa.
  const x = inv[8], y = inv[9], z = inv[10], w = inv[11]
  if (Math.abs(w) < 1e-30) return null
  return [x / w, y / w, z / w]
}

/** Inversa de uma matriz 4×4 em coluna (como gl-matrix), em float64. */
export function invert4(a: ArrayLike<number>): number[] | null {
  const a00 = a[0], a01 = a[1], a02 = a[2], a03 = a[3]
  const a10 = a[4], a11 = a[5], a12 = a[6], a13 = a[7]
  const a20 = a[8], a21 = a[9], a22 = a[10], a23 = a[11]
  const a30 = a[12], a31 = a[13], a32 = a[14], a33 = a[15]
  const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10, b02 = a00 * a13 - a03 * a10
  const b03 = a01 * a12 - a02 * a11, b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12
  const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30, b08 = a20 * a33 - a23 * a30
  const b09 = a21 * a32 - a22 * a31, b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32
  let det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06
  if (!det) return null
  det = 1 / det
  return [
    (a11 * b11 - a12 * b10 + a13 * b09) * det, (a02 * b10 - a01 * b11 - a03 * b09) * det, (a31 * b05 - a32 * b04 + a33 * b03) * det, (a22 * b04 - a21 * b05 - a23 * b03) * det,
    (a12 * b08 - a10 * b11 - a13 * b07) * det, (a00 * b11 - a02 * b08 + a03 * b07) * det, (a32 * b02 - a30 * b05 - a33 * b01) * det, (a20 * b05 - a22 * b02 + a23 * b01) * det,
    (a10 * b10 - a11 * b08 + a13 * b06) * det, (a01 * b08 - a00 * b10 - a03 * b06) * det, (a30 * b04 - a31 * b02 + a33 * b00) * det, (a21 * b02 - a20 * b04 - a23 * b00) * det,
    (a11 * b07 - a10 * b09 - a12 * b06) * det, (a00 * b09 - a01 * b07 + a02 * b06) * det, (a31 * b01 - a30 * b03 - a32 * b00) * det, (a20 * b03 - a21 * b01 + a22 * b00) * det,
  ]
}

/** Multiplica duas matrizes 4×4 em coluna (a × b), em float64. */
export function multiply4(a: ArrayLike<number>, b: ArrayLike<number>): number[] {
  const out = new Array<number>(16)
  for (let c = 0; c < 4; c++)
    for (let r = 0; r < 4; r++) out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1] + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3]
  return out
}
