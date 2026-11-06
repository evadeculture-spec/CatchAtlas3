import type { CustomLayerInterface, CustomRenderMethodInput, Map as MLMap } from 'maplibre-gl'
import { FLOATS_PER_VERTEX, eyeFromMatrix, multiply4, visibleWallIndices, type SlabMesh } from './slabMesh'

/**
 * Paredes da laje peninsular: camada personalizada georreferenciada do próprio MapLibre
 * (mesma câmara, mesma projeção, mesmo buffer de profundidade).
 *
 * - renderingMode '2d': desenhada na ordem do estilo, por cima do mar e do contexto e por baixo da
 *   água, dos rótulos e das linhas. Só as paredes voltadas para a câmara são desenhadas, da mais
 *   distante para a mais próxima (as de trás ficariam por baixo da própria terra).
 * - As paredes ficam ABAIXO do nível do mapa (z de 0 a −espessura): o topo coincide com a linha de
 *   costa desenhada pelo mapa; nada flutua.
 * - Só desenha quando algo muda (o MapLibre chama `render` apenas quando há novo frame).
 */
export interface SlabLayerState {
  /** Espessura atual em metros (0 desliga). */
  depthM: number
  /** 0–1 (desvanecimento ao aproximar). */
  opacity: number
}

const VERT = `#version 300 es
precision highp float;
in vec2 a_pos;
in float a_t;
in vec2 a_normal;
in float a_kind;
uniform mat4 u_matrix;
uniform float u_depth;
uniform float u_shadow;
out float v_t;
out float v_kind;
out float v_light;
void main() {
  vec3 p;
  if (a_kind > 2.5) {
    p = vec3(a_pos, 0.0);
  } else if (a_kind < 1.5) {
    p = vec3(a_pos, -u_depth * a_t);
  } else {
    p = vec3(a_pos + a_normal * u_shadow * a_t, -u_depth);
  }
  // Luz rasante de sudoeste: as faces viradas a sul/oeste ficam mais claras (normal com y para sul).
  vec2 L = normalize(vec2(-0.55, 0.83));
  v_light = 0.62 + 0.38 * max(dot(a_normal, L), 0.0) + 0.08 * a_normal.y;
  v_t = a_t;
  v_kind = a_kind;
  gl_Position = u_matrix * vec4(p, 1.0);
}`

const FRAG = `#version 300 es
precision mediump float;
in float v_t;
in float v_kind;
in float v_light;
uniform float u_opacity;
uniform vec3 u_top;
uniform vec3 u_bottom;
uniform vec3 u_cut;
out vec4 fragColor;
void main() {
  if (v_kind > 1.5) {
    // Sombra de contacto: escurece o fundo junto à base da parede.
    float a = 0.28 * (1.0 - v_t) * (1.0 - v_t) * u_opacity;
    fragColor = vec4(0.0, 0.0, 0.0, a);
    return;
  }
  vec3 base = v_kind > 0.5 ? u_cut : mix(u_top, u_bottom, smoothstep(0.0, 1.0, v_t));
  // Aresta superior ligeiramente iluminada (lábio da peça).
  float lip = 1.0 + 0.22 * (1.0 - smoothstep(0.0, 0.06, v_t));
  vec3 c = base * v_light * lip;
  fragColor = vec4(c * u_opacity, u_opacity);
}`

const hex = (h: string): [number, number, number] => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]

export function createSlabLayer(mesh: SlabMesh, getState: () => SlabLayerState, colors = { top: '#3b5446', bottom: '#14231f', cut: '#55645a' }): CustomLayerInterface {
  let program: WebGLProgram | null = null
  let vbo: WebGLBuffer | null = null
  let ibo: WebGLBuffer | null = null
  let sbo: WebGLBuffer | null = null
  let tbo: WebGLBuffer | null = null
  let vao: WebGLVertexArrayObject | null = null
  let uni: Record<string, WebGLUniformLocation | null> = {}
  let lastEye: [number, number] | null = null
  let wallCount = 0
  const idxScratch = new Uint32Array(mesh.edges.length * 6)

  const compile = (gl: WebGL2RenderingContext, type: number, src: string) => {
    const s = gl.createShader(type)!
    gl.shaderSource(s, src)
    gl.compileShader(s)
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(`Laje: shader inválido: ${gl.getShaderInfoLog(s)}`)
    return s
  }

  return {
    id: 'atlas-slab-walls',
    type: 'custom',
    renderingMode: '2d',
    onAdd(_map: MLMap, gl: WebGL2RenderingContext) {
      const p = gl.createProgram()!
      gl.attachShader(p, compile(gl, gl.VERTEX_SHADER, VERT))
      gl.attachShader(p, compile(gl, gl.FRAGMENT_SHADER, FRAG))
      gl.linkProgram(p)
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(`Laje: programa inválido: ${gl.getProgramInfoLog(p)}`)
      program = p
      uni = Object.fromEntries(['u_matrix', 'u_depth', 'u_shadow', 'u_opacity', 'u_top', 'u_bottom', 'u_cut'].map((n) => [n, gl.getUniformLocation(p, n)]))
      // Repõe o estado do MapLibre no fim (o buffer de índices pertence ao VAO ativo).
      const prevVao = gl.getParameter(gl.VERTEX_ARRAY_BINDING) as WebGLVertexArrayObject | null
      const prevArray = gl.getParameter(gl.ARRAY_BUFFER_BINDING) as WebGLBuffer | null
      vao = gl.createVertexArray()
      gl.bindVertexArray(vao)
      vbo = gl.createBuffer()
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo)
      gl.bufferData(gl.ARRAY_BUFFER, mesh.vertices, gl.STATIC_DRAW)
      const stride = FLOATS_PER_VERTEX * 4
      const attr = (name: string, size: number, offset: number) => {
        const loc = gl.getAttribLocation(p, name)
        if (loc < 0) return
        gl.enableVertexAttribArray(loc)
        gl.vertexAttribPointer(loc, size, gl.FLOAT, false, stride, offset * 4)
      }
      attr('a_pos', 2, 0)
      attr('a_t', 1, 2)
      attr('a_normal', 2, 3)
      attr('a_kind', 1, 5)
      sbo = gl.createBuffer()
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sbo)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.shadowIndices, gl.STATIC_DRAW)
      tbo = gl.createBuffer()
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tbo)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, mesh.topIndices, gl.STATIC_DRAW)
      ibo = gl.createBuffer()
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
      gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idxScratch.byteLength, gl.DYNAMIC_DRAW)
      gl.bindVertexArray(prevVao)
      gl.bindBuffer(gl.ARRAY_BUFFER, prevArray)
      lastEye = null
    },
    onRemove(_map: MLMap, gl: WebGL2RenderingContext) {
      if (vbo) gl.deleteBuffer(vbo)
      if (ibo) gl.deleteBuffer(ibo)
      if (sbo) gl.deleteBuffer(sbo)
      if (tbo) gl.deleteBuffer(tbo)
      if (vao) gl.deleteVertexArray(vao)
      if (program) gl.deleteProgram(program)
      program = vbo = ibo = sbo = tbo = vao = null
    },
    render(gl: WebGL2RenderingContext, options: CustomRenderMethodInput) {
      const { depthM, opacity } = getState()
      if (!program || !vao || opacity <= 0.003 || depthM <= 0) return
      // Matriz com a origem da malha (float64 no CPU; os vértices ficam pequenos em float32).
      // mainMatrix: x,y em Mercator 0–1 e z conforme (unidades Mercator) — ver CustomRenderMethodInput.
      const m = options.defaultProjectionData.mainMatrix as unknown as ArrayLike<number>
      const t = [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, mesh.origin[0], mesh.origin[1], 0, 1]
      const matrix = new Float32Array(multiply4(m, t))
      // Câmara em Mercator relativo à origem: escolhe e ordena as paredes visíveis quando muda.
      gl.bindVertexArray(vao)
      const eye = eyeFromMatrix(matrix)
      if (eye && (!lastEye || Math.abs(eye[0] - lastEye[0]) + Math.abs(eye[1] - lastEye[1]) > 1e-5)) {
        lastEye = [eye[0], eye[1]]
        const idx = visibleWallIndices(mesh, lastEye, idxScratch)
        wallCount = idx.length
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
        gl.bufferSubData(gl.ELEMENT_ARRAY_BUFFER, 0, idx)
      }
      // Espessura em unidades Mercator (o z é conforme: 1 m = 1/perímetro à latitude do centro).
      const latRad = Math.atan(Math.sinh(Math.PI * (1 - 2 * mesh.origin[1])))
      const metersToMerc = 1 / (40075016.68557849 * Math.cos(latRad))
      const depth = depthM * metersToMerc
      gl.useProgram(program)
      gl.uniformMatrix4fv(uni.u_matrix, false, matrix)
      gl.uniform1f(uni.u_depth, depth)
      gl.uniform1f(uni.u_shadow, depth * 0.4)
      gl.uniform1f(uni.u_opacity, opacity)
      gl.uniform3fv(uni.u_top, hex(colors.top))
      gl.uniform3fv(uni.u_bottom, hex(colors.bottom))
      gl.uniform3fv(uni.u_cut, hex(colors.cut))
      gl.enable(gl.BLEND)
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA)
      gl.disable(gl.CULL_FACE)
      // 0) Pré-passo de profundidade com o topo da laje (z = 0). Uma parede que no ecrã se sobreponha à
      //    superfície da laje está sempre atrás dela (as paredes ficam abaixo do nível 0 e a câmara está
      //    acima), por isso escrever o topo um sub-nível à frente da profundidade desta camada esconde as
      //    paredes de trás (rias, reentrâncias) sem esconder as que pendem sobre o mar. Os sub-níveis
      //    seguem o esquema do MapLibre (2^-16 por sub-nível), por isso as camadas seguintes não são afetadas.
      const depthOn = gl.isEnabled(gl.DEPTH_TEST)
      const range = gl.getParameter(gl.DEPTH_RANGE) as Float32Array
      const d = range[0]
      if (depthOn) {
        const near = Math.max(0, d - 1 / 65536)
        gl.colorMask(false, false, false, false)
        gl.depthMask(true)
        gl.depthFunc(gl.LEQUAL)
        gl.depthRange(near, near)
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, tbo)
        gl.drawElements(gl.TRIANGLES, mesh.topIndices.length, gl.UNSIGNED_INT, 0)
        gl.colorMask(true, true, true, true)
        gl.depthMask(false)
        gl.depthRange(d, d)
      }
      // 1) sombra de contacto (no fundo), 2) paredes visíveis, da mais distante para a mais próxima.
      gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, sbo)
      gl.drawElements(gl.TRIANGLES, mesh.shadowIndices.length, gl.UNSIGNED_INT, 0)
      if (wallCount) {
        gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ibo)
        gl.drawElements(gl.TRIANGLES, wallCount, gl.UNSIGNED_INT, 0)
      }
      gl.bindVertexArray(null)
      gl.depthRange(range[0], range[1])
    },
  }
}
