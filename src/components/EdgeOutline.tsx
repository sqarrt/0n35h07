import { forwardRef, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { Effect, EffectAttribute, NormalPass } from 'postprocessing'
import { DepthTexture, Uniform, Vector2, WebGLRenderTarget } from 'three'
import type { Camera, Scene, Texture, WebGLRenderer, WebGLRenderTarget as RT } from 'three'

/**
 * Экранный контур видимых рёбер ТОЛЬКО на блоках (кубы/клинья на слое BLOCK_LAYER).
 * Блоки рендерятся в отдельный буфер нормалей+глубины (слой-ограниченный NormalPass). Ребро = разрыв нормалей
 * соседних пикселей, НО только там, где блок реально виден: его глубина совпадает со сценной (не перекрыт
 * игроком/стеной). Пол/стены/игроки не на слое → их нет в буфере, контур их не задевает; перекрытые блоки
 * тоже не подсвечиваются. Цвет ребра = цвет блока из кадра, осветлённый.
 */
export const BLOCK_LAYER = 1

const THICKNESS = 1.0     // толщина выборки в ЭКРАННЫХ px → одинаковая на любой дистанции; тоньше
const THRESH = 0.1        // порог суммы расстояний нормалей соседей
const GAIN = 2.0          // во сколько раз светлее цвет блока на ребре
const DEPTH_EPS = 0.15    // допуск сравнения глубин в МИРОВЫХ единицах (через getViewZ) — без протекания на игрока

const fragmentShader = /* glsl */`
uniform sampler2D uNormal;
uniform sampler2D uBlockDepth;
uniform vec2 uTexel;
uniform float uThickness;
uniform float uThresh;
uniform float uGain;
uniform float uDepthEps;

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec2 o = uTexel * uThickness;
  vec3 n  = texture2D(uNormal, uv).xyz;
  vec3 nl = texture2D(uNormal, uv - vec2(o.x, 0.0)).xyz;
  vec3 nr = texture2D(uNormal, uv + vec2(o.x, 0.0)).xyz;
  vec3 nd = texture2D(uNormal, uv - vec2(0.0, o.y)).xyz;
  vec3 nu = texture2D(uNormal, uv + vec2(0.0, o.y)).xyz;
  float dN = distance(n, nl) + distance(n, nr) + distance(n, nd) + distance(n, nu);

  float blockD = texture2D(uBlockDepth, uv).r;
  float isBlock = step(blockD, 0.9999);                          // в этом пикселе есть блок (не дальняя плоскость)
  // Видим, если сцена не ближе блока более чем на eps (мировые единицы) — иначе блок перекрыт игроком/стеной.
  float visible = step(getViewZ(depth) - getViewZ(blockD), uDepthEps);

  float edge = isBlock * visible * smoothstep(uThresh, uThresh * 2.0, dN);
  vec3 lighter = min(inputColor.rgb * uGain, vec3(1.0));
  outputColor = vec4(mix(inputColor.rgb, lighter, edge), inputColor.a);
}
`

/** NormalPass, рендерящий ТОЛЬКО слой блоков. Ограничиваем все камеры, которыми может рендерить
 * внутренний renderPass (this.camera / renderPass.camera / renderPass.mainCamera), на BLOCK_LAYER. */
class BlockNormalPass extends NormalPass {
  override render(renderer: WebGLRenderer, inputBuffer: RT | null, outputBuffer: RT | null, deltaTime?: number, stencilTest?: boolean) {
    const self = this as unknown as { camera?: Camera; renderPass?: { camera?: Camera; mainCamera?: Camera } }
    const cams = new Set<Camera>()
    for (const c of [self.camera, self.renderPass?.camera, self.renderPass?.mainCamera]) if (c) cams.add(c)
    const saved = [...cams].map(c => c.layers.mask)
    cams.forEach(c => c.layers.set(BLOCK_LAYER))
    try { super.render(renderer, inputBuffer, outputBuffer, deltaTime, stencilTest) }
    finally { [...cams].forEach((c, i) => { c.layers.mask = saved[i] }) }
  }
}

class EdgeEffect extends Effect {
  constructor(normalTexture: Texture, blockDepth: Texture, texel: Vector2) {
    super('EdgeEffect', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uNormal', new Uniform(normalTexture)],
        ['uBlockDepth', new Uniform(blockDepth)],
        ['uTexel', new Uniform(texel)],
        ['uThickness', new Uniform(THICKNESS)],
        ['uThresh', new Uniform(THRESH)],
        ['uGain', new Uniform(GAIN)],
        ['uDepthEps', new Uniform(DEPTH_EPS)],
      ]),
    })
  }
}

/** Композер с блочным NormalPass (+глубина) и эффектом-контуром. Ставится внутри Canvas. */
export const MapEdges = forwardRef<unknown>(function MapEdges(_props, _ref) {
  const scene = useThree(s => s.scene)
  const camera = useThree(s => s.camera)
  const size = useThree(s => s.size)

  // Свой RT с depthTexture — чтобы у блочного пасса была и нормаль, и глубина блоков.
  const target = useMemo(() => {
    const rt = new WebGLRenderTarget(size.width, size.height)
    rt.depthTexture = new DepthTexture(size.width, size.height)
    return rt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pass = useMemo(() => new BlockNormalPass(scene as Scene, camera, { renderTarget: target }), [scene, camera, target])
  const effect = useMemo(() => new EdgeEffect(pass.texture, target.depthTexture as Texture, new Vector2(1 / size.width, 1 / size.height)), [pass, target]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { (effect.uniforms.get('uTexel')!.value as Vector2).set(1 / size.width, 1 / size.height) }, [effect, size])
  useEffect(() => () => { pass.dispose(); effect.dispose(); target.dispose() }, [pass, effect, target])

  return (
    <EffectComposer>
      <primitive object={pass} />
      <primitive object={effect} />
    </EffectComposer>
  )
})
