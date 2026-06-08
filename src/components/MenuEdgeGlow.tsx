import { useEffect, useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import { Effect, EffectAttribute, EffectPass, Pass } from 'postprocessing'
import { DepthTexture, HalfFloatType, Uniform, Vector2, WebGLRenderTarget } from 'three'
import type { Camera, Scene, Texture, WebGLRenderer, WebGLRenderTarget as RT } from 'three'
import type { AudioAnalysis } from '../game/audio/AudioAnalysis'

/**
 * Свечение ВИДИМЫХ краёв меню-моделей (тот же принцип, что подсветка блоков: отдельный слой-ограниченный
 * рендер + детект рёбер + проверка глубины), но эффект — Bloom. Детект — по РАЗРЫВУ ГЛУБИНЫ слоя моделей,
 * отрисованного ИХ реальными материалами → обводка идёт по настоящему силуэту (волны) и по кольцу планеты.
 * Кромка делается яркой (HDR > 1) и отдельным проходом Bloom растекается в мягкое свечение; в тишине — ноль.
 */
export const MENU_GLOW_LAYER = 2   // отдельно от игрового BLOCK_LAYER (1)

const THICKNESS = 3.5       // толщина выборки рёбер в экранных px
const DEPTH_THRESH = 0.06   // порог разрыва глубины (мировые ед.): силуэт огромный, ступень кольца ~0.3
const EDGE_GAIN = 4.0       // яркость кромки в HDR (>1) → Bloom её ловит, поверхность (≤1) нет
const EDGE_WHITE = 0.5      // подмешать белого → ровная яркость кромки по всем цветам
const LEVEL_GAIN = 3.2      // усиление RMS звука
const GLOW_SMOOTH = 0.18    // сглаживание пульсации
const INTENSITY_BASE = 0.0  // в тишине свечения НЕТ совсем
const INTENSITY_GAIN = 1.1  // яркость кромки на пике звука
const BLOOM_INTENSITY = 1.5
const BLOOM_THRESHOLD = 1.1  // блумит только HDR-яркую кромку (>1), не поверхность/фон
const BLOOM_SMOOTHING = 0.3
const BLOOM_RADIUS = 0.55    // уже радиус → гало плотнее у кромки, не расползается на фон на громких

const fragmentShader = /* glsl */`
uniform sampler2D uObjDepth;
uniform vec2 uTexel;
uniform float uThickness;
uniform float uThresh;
uniform float uGain;
uniform float uWhite;
uniform float uIntensity;

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec2 o = uTexel * uThickness;
  float dC = texture2D(uObjDepth, uv).r;
  float isObj = step(dC, 0.9999);                                  // тут есть модель (не дальняя плоскость)
  float zC = getViewZ(dC);
  float zL = getViewZ(texture2D(uObjDepth, uv - vec2(o.x, 0.0)).r);
  float zR = getViewZ(texture2D(uObjDepth, uv + vec2(o.x, 0.0)).r);
  float zD = getViewZ(texture2D(uObjDepth, uv - vec2(0.0, o.y)).r);
  float zU = getViewZ(texture2D(uObjDepth, uv + vec2(0.0, o.y)).r);
  float diff = abs(zC - zL) + abs(zC - zR) + abs(zC - zD) + abs(zC - zU);   // разрыв глубины = край силуэта/ступень
  float edge = isObj * smoothstep(uThresh, uThresh * 2.0, diff);

  vec3 edgeCol = mix(inputColor.rgb, vec3(1.0), uWhite) * uGain;
  outputColor = vec4(inputColor.rgb + edge * edgeCol * uIntensity, inputColor.a);
}
`

/** Рендер слоя меню-моделей ИХ реальными материалами в отдельный RT (нужна только глубина: с волнами+кольцом). */
class ObjDepthPass extends Pass {
  private objScene: Scene
  private objCamera: Camera
  private rt: RT

  constructor(scene: Scene, camera: Camera, rt: RT) {
    super('ObjDepthPass')
    this.objScene = scene
    this.objCamera = camera
    this.rt = rt
    this.needsSwap = false   // не трогаем основной буфер — только пишем свой depth
  }

  override render(renderer: WebGLRenderer, _inputBuffer: RT | null, _outputBuffer: RT | null) {
    const saved = this.objCamera.layers.mask
    const prev = renderer.getRenderTarget()
    this.objCamera.layers.set(MENU_GLOW_LAYER)
    renderer.setRenderTarget(this.rt)
    renderer.clear(true, true, false)              // чистим цвет+глубину (фон → дальняя плоскость)
    renderer.render(this.objScene, this.objCamera)
    renderer.setRenderTarget(prev)
    this.objCamera.layers.mask = saved
  }
}

class EdgeGlowEffect extends Effect {
  constructor(objDepth: Texture, texel: Vector2) {
    super('EdgeGlowEffect', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uObjDepth', new Uniform(objDepth)],
        ['uTexel', new Uniform(texel)],
        ['uThickness', new Uniform(THICKNESS)],
        ['uThresh', new Uniform(DEPTH_THRESH)],
        ['uGain', new Uniform(EDGE_GAIN)],
        ['uWhite', new Uniform(EDGE_WHITE)],
        ['uIntensity', new Uniform(INTENSITY_BASE)],
      ]),
    })
  }
}

/** Композер: depth слоя моделей (реальные материалы) → яркая кромка по разрыву глубины → Bloom (свечение). */
export function MenuEdgeGlow({ analysis }: { analysis?: AudioAnalysis }) {
  const scene = useThree(s => s.scene)
  const camera = useThree(s => s.camera)
  const size = useThree(s => s.size)
  const dpr = useThree(s => s.gl.getPixelRatio())   // composer рендерит в size×dpr — depth держим в той же плотности

  const target = useMemo(() => {
    const w = Math.round(size.width * dpr), h = Math.round(size.height * dpr)
    const rt = new WebGLRenderTarget(w, h)
    rt.depthTexture = new DepthTexture(w, h)
    return rt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pass = useMemo(() => new ObjDepthPass(scene as Scene, camera, target), [scene, camera, target])
  const effect = useMemo(() => new EdgeGlowEffect(target.depthTexture as Texture, new Vector2(1 / size.width, 1 / size.height)), [target]) // eslint-disable-line react-hooks/exhaustive-deps
  // Edge-эффект — ОТДЕЛЬНЫМ проходом, затем компонент <Bloom> своим проходом её размывает.
  const edgePass = useMemo(() => new EffectPass(camera, effect), [camera, effect])
  useEffect(() => { (effect.uniforms.get('uTexel')!.value as Vector2).set(1 / size.width, 1 / size.height) }, [effect, size])
  useEffect(() => () => { pass.dispose(); effect.dispose(); edgePass.dispose(); target.dispose() }, [pass, effect, edgePass, target])

  const lvl = useRef(0)
  useFrame(() => {
    const tgt = Math.min(1, (analysis?.level() ?? 0) * LEVEL_GAIN)
    lvl.current += (tgt - lvl.current) * GLOW_SMOOTH
    const u = effect.uniforms.get('uIntensity')!
    u.value = INTENSITY_BASE + lvl.current * INTENSITY_GAIN
  })

  // HDR-буфер (HalfFloat): кромка ярче 1.0 переживает буфер → Bloom ловит ТОЛЬКО её, не поверхность/фон (≤1).
  return (
    <EffectComposer frameBufferType={HalfFloatType}>
      <primitive object={pass} />
      <primitive object={edgePass} />
      <Bloom intensity={BLOOM_INTENSITY} luminanceThreshold={BLOOM_THRESHOLD} luminanceSmoothing={BLOOM_SMOOTHING} radius={BLOOM_RADIUS} mipmapBlur />
    </EffectComposer>
  )
}
