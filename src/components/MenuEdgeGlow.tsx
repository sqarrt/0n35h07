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

const BLUR_PX = 4.0         // радиус диска усреднения края (= мягкость/размытость обводки в экранных px)
const GRAD_PX = 1.5         // шаг градиента глубины (px) — детект склонов (волны) и силуэта
const DEPTH_THRESH = 0.05   // порог градиента глубины: силуэт огромный, склоны волн/ступень кольца — умеренные
const EDGE_GAIN = 4.0       // яркость обводки в HDR (>1) → Bloom её ловит, поверхность (≤1) нет
const EDGE_WHITE = 0.15     // немного белого для яркости/видимости; в основном — экранный цвет модели (с градиентами)
const LEVEL_GAIN = 3.2      // усиление RMS звука
const GLOW_SMOOTH = 0.18    // сглаживание пульсации
const INTENSITY_BASE = 0.0  // в тишине свечения НЕТ совсем
const INTENSITY_GAIN = 1.1  // яркость кромки на пике звука
const BLOOM_INTENSITY = 1.5
const BLOOM_THRESHOLD = 1.1  // блумит только HDR-яркую кромку (>1), не поверхность/фон
const BLOOM_SMOOTHING = 0.3
const BLOOM_RADIUS = 0.55    // уже радиус → гало плотнее у кромки, не расползается на фон на громких

// 16 точек диска (два кольца) — усредняем по ним край (= размытие обводки).
const fragmentShader = /* glsl */`
uniform sampler2D uObjDepth;
uniform sampler2D uObjColor;
uniform vec2 uTexel;
uniform float uBlurPx;
uniform float uGradPx;
uniform float uThresh;
uniform float uGain;
uniform float uWhite;
uniform float uIntensity;

const int K = 8;   // одно кольцо выборок (производительность: фуллскрин-шейдер каждый кадр)
const vec2 DISK[8] = vec2[8](
  vec2(1.0,0.0), vec2(0.7071,0.7071), vec2(0.0,1.0), vec2(-0.7071,0.7071),
  vec2(-1.0,0.0), vec2(-0.7071,-0.7071), vec2(0.0,-1.0), vec2(0.7071,-0.7071)
);

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec2 g = uTexel * uGradPx;
  float acc = 0.0;          // накопленный край (по диску → мягкая размытая обводка)
  vec3 colAcc = vec3(0.0);  // цвет модели у края
  float colW = 0.0;
  for (int i = 0; i < K; i++) {
    vec2 p = uv + DISK[i] * uBlurPx * uTexel;
    float dc = texture2D(uObjDepth, p).r;
    float io = step(dc, 0.9999);                       // сэмпл на модели?
    float zc = getViewZ(dc);
    float diff = abs(zc - getViewZ(texture2D(uObjDepth, p - vec2(g.x, 0.0)).r))
               + abs(zc - getViewZ(texture2D(uObjDepth, p + vec2(g.x, 0.0)).r))
               + abs(zc - getViewZ(texture2D(uObjDepth, p - vec2(0.0, g.y)).r))
               + abs(zc - getViewZ(texture2D(uObjDepth, p + vec2(0.0, g.y)).r));
    acc += io * smoothstep(uThresh, uThresh * 2.0, diff);   // край = резкий градиент глубины
    colAcc += texture2D(uObjColor, p).rgb * io;             // цвет модели в этой точке
    colW += io;
  }
  float outline = acc / float(K);
  vec3 modelCol = colW > 0.0 ? colAcc / colW : vec3(1.0);   // средний цвет модели у края
  vec3 edgeCol = mix(modelCol, vec3(1.0), uWhite) * uGain;  // обводка в цвет модели (+ чуть белого для яркости)
  outputColor = vec4(inputColor.rgb + outline * edgeCol * uIntensity, inputColor.a);
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
  constructor(objDepth: Texture, objColor: Texture, texel: Vector2) {
    super('EdgeGlowEffect', fragmentShader, {
      attributes: EffectAttribute.DEPTH,
      uniforms: new Map<string, Uniform>([
        ['uObjDepth', new Uniform(objDepth)],
        ['uObjColor', new Uniform(objColor)],
        ['uTexel', new Uniform(texel)],
        ['uBlurPx', new Uniform(BLUR_PX)],
        ['uGradPx', new Uniform(GRAD_PX)],
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
  const effect = useMemo(() => new EdgeGlowEffect(target.depthTexture as Texture, target.texture, new Vector2(1 / size.width, 1 / size.height)), [target]) // eslint-disable-line react-hooks/exhaustive-deps
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
