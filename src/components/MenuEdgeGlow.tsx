import { useEffect, useMemo, useRef } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { BloomEffect, Effect, EffectAttribute, EffectPass, Pass } from 'postprocessing'
import { DepthTexture, HalfFloatType, Uniform, Vector2, WebGLRenderTarget } from 'three'
import type { Camera, Scene, Texture, WebGLRenderer, WebGLRenderTarget as RT } from 'three'
import type { AudioAnalysis } from '../game/audio/AudioAnalysis'

/**
 * Glow on the VISIBLE edges of menu models (same principle as block highlighting: a separate layer-limited
 * render + edge detect + depth check), but the effect is Bloom. Detection is by the DEPTH DISCONTINUITY of the
 * model layer rendered with THEIR real materials → the outline follows the true silhouette (waves) and planet ring.
 * The edge is made bright (HDR > 1) and a separate Bloom pass spreads it into a soft glow; in silence — zero.
 */
export const MENU_GLOW_LAYER = 2   // separate from the game BLOCK_LAYER (1)

const BLUR_PX = 4.0         // edge-averaging disk radius (= outline softness/blur in screen px)
const GRAD_PX = 1.5         // depth gradient step (px) — detects slopes (waves) and silhouette
const DEPTH_THRESH = 0.05   // depth gradient threshold: the silhouette is huge, wave slopes/ring step are moderate
const EDGE_GAIN = 4.0       // outline brightness in HDR (>1) → Bloom catches it, surfaces (≤1) not
const EDGE_WHITE = 0.15     // a bit of white for brightness/visibility; mostly the on-screen model color (with gradients)
const LEVEL_GAIN = 3.2      // RMS audio gain (before the perceptual √x curve)
const GLOW_SMOOTH = 0.18    // pulse smoothing
const INTENSITY_BASE = 0.0  // in silence there is NO glow at all
const INTENSITY_GAIN = 1.1  // edge brightness at the audio peak
const BLOOM_INTENSITY = 1.5
const BLOOM_THRESHOLD = 1.1  // blooms only the HDR-bright edge (>1), not the surface/background
const BLOOM_SMOOTHING = 0.3
const BLOOM_RADIUS = 0.55    // tighter radius → the halo is denser at the edge, doesn't spread onto the background when loud

// Radio takeover: a SECOND, SOFT full-scene bloom in the SAME composer (one composer → no remount/recompile/freeze).
// Both blooms are built IMPERATIVELY as <primitive> passes (mixing the <Bloom> JSX wrapper with imperative passes
// broke the edge glow). The soft bloom stays at intensity 0 until softBloom (radio) eases it in.
const SOFT_THRESHOLD = 0.0   // bloom EVERYTHING → diffuse frosted-glass haze (not crisp edges)
const SOFT_RADIUS = 0.95     // wide, blurry halo ("light through fogged glass")
const SOFT_BASE = 0.35       // hazy glow even in silence (once radio is on)
const SOFT_GAIN = 1.4
const SOFT_LEVEL_GAIN = 1.6
const SOFT_LEVEL_SMOOTH = 0.18
const SOFT_FADE_TAU = 0.06   // ~0.2s ease in/out as softBloom toggles
const RADIO_EDGE_BOOST = 1.8 // the orb edge glow is amplified during radio (the user's "усиливается")

// 16 disk points (two rings) — we average the edge over them (= outline blur).
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

const int K = 8;   // one ring of samples (performance: fullscreen shader every frame)
const vec2 DISK[8] = vec2[8](
  vec2(1.0,0.0), vec2(0.7071,0.7071), vec2(0.0,1.0), vec2(-0.7071,0.7071),
  vec2(-1.0,0.0), vec2(-0.7071,-0.7071), vec2(0.0,-1.0), vec2(0.7071,-0.7071)
);

void mainImage(const in vec4 inputColor, const in vec2 uv, const in float depth, out vec4 outputColor) {
  vec2 g = uTexel * uGradPx;
  float acc = 0.0;          // accumulated edge (over the disk → soft blurred outline)
  vec3 colAcc = vec3(0.0);  // model color at the edge
  float colW = 0.0;
  for (int i = 0; i < K; i++) {
    vec2 p = uv + DISK[i] * uBlurPx * uTexel;
    float dc = texture2D(uObjDepth, p).r;
    float io = step(dc, 0.9999);                       // sample on a model?
    float zc = getViewZ(dc);
    float diff = abs(zc - getViewZ(texture2D(uObjDepth, p - vec2(g.x, 0.0)).r))
               + abs(zc - getViewZ(texture2D(uObjDepth, p + vec2(g.x, 0.0)).r))
               + abs(zc - getViewZ(texture2D(uObjDepth, p - vec2(0.0, g.y)).r))
               + abs(zc - getViewZ(texture2D(uObjDepth, p + vec2(0.0, g.y)).r));
    acc += io * smoothstep(uThresh, uThresh * 2.0, diff);   // edge = sharp depth gradient
    colAcc += texture2D(uObjColor, p).rgb * io;             // model color at this point
    colW += io;
  }
  float outline = acc / float(K);
  vec3 modelCol = colW > 0.0 ? colAcc / colW : vec3(1.0);   // average model color at the edge
  vec3 edgeCol = mix(modelCol, vec3(1.0), uWhite) * uGain;  // outline in the model color (+ a bit of white for brightness)
  outputColor = vec4(inputColor.rgb + outline * edgeCol * uIntensity, inputColor.a);
}
`

/** Renders the menu-model layer with THEIR real materials into a separate RT (only depth needed: with waves+ring). */
class ObjDepthPass extends Pass {
  private objScene: Scene
  private objCamera: Camera
  private rt: RT

  constructor(scene: Scene, camera: Camera, rt: RT) {
    super('ObjDepthPass')
    this.objScene = scene
    this.objCamera = camera
    this.rt = rt
    this.needsSwap = false   // don't touch the main buffer — only write our own depth
  }

  override render(renderer: WebGLRenderer, _inputBuffer: RT | null, _outputBuffer: RT | null) {
    const saved = this.objCamera.layers.mask
    const prev = renderer.getRenderTarget()
    this.objCamera.layers.set(MENU_GLOW_LAYER)
    renderer.setRenderTarget(this.rt)
    renderer.clear(true, true, false)              // clear color+depth (background → far plane)
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

/** Composer: model-layer depth (real materials) → bright edge from the depth discontinuity → Bloom (glow).
 *  `muted` — instantly kills the glow (intensity → 0) WITHOUT unmounting: the composer stays
 *  compiled, re-enabling has no delay (the "Appearance" screen mutes the outline). */
export function MenuEdgeGlow({ analysis, muted = false, enabled = true, softBloom = false }: { analysis?: AudioAnalysis; muted?: boolean; enabled?: boolean; softBloom?: boolean }) {
  const scene = useThree(s => s.scene)
  const camera = useThree(s => s.camera)
  const size = useThree(s => s.size)
  const dpr = useThree(s => s.gl.getPixelRatio())   // composer renders at size×dpr — keep depth at the same density

  const target = useMemo(() => {
    const w = Math.round(size.width * dpr), h = Math.round(size.height * dpr)
    const rt = new WebGLRenderTarget(w, h)
    rt.depthTexture = new DepthTexture(w, h)
    return rt
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const pass = useMemo(() => new ObjDepthPass(scene as Scene, camera, target), [scene, camera, target])
  const effect = useMemo(() => new EdgeGlowEffect(target.depthTexture as Texture, target.texture, new Vector2(1 / size.width, 1 / size.height)), [target]) // eslint-disable-line react-hooks/exhaustive-deps
  const edgePass = useMemo(() => new EffectPass(camera, effect), [camera, effect])
  // ONE Bloom that MORPHS between two looks (no second Bloom pass — two of them in a composer clamps the HDR buffer
  // and kills the edge glow). MENU: threshold 1.1 + tight radius → blooms ONLY the HDR orb edges (crisp edge glow).
  // RADIO: threshold → 0 + wide radius → blooms the WHOLE scene (frosted-glass haze) AND the edges (the orb glow
  // stays, just softer). luminanceMaterial.threshold / mipmapBlurPass.radius / intensity are all runtime-settable.
  const bloom = useMemo(() => new BloomEffect({ luminanceThreshold: BLOOM_THRESHOLD, luminanceSmoothing: BLOOM_SMOOTHING, mipmapBlur: true, radius: BLOOM_RADIUS, intensity: BLOOM_INTENSITY }), [])
  const bloomPass = useMemo(() => new EffectPass(camera, bloom), [camera, bloom])
  useEffect(() => { (effect.uniforms.get('uTexel')!.value as Vector2).set(1 / size.width, 1 / size.height) }, [effect, size])
  useEffect(() => () => { pass.dispose(); effect.dispose(); edgePass.dispose(); bloom.dispose(); bloomPass.dispose(); target.dispose() }, [pass, effect, edgePass, bloom, bloomPass, target])

  const lvl = useRef(0)
  const softLvl = useRef(0)
  const fade = useRef(0)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const level = analysis?.level() ?? 0
    // Edge outline brightness — reacts to music (√x perceptual), amplified during radio.
    const tgt = muted ? 0 : Math.min(1, Math.sqrt(level * LEVEL_GAIN))
    lvl.current += (tgt - lvl.current) * GLOW_SMOOTH
    effect.uniforms.get('uIntensity')!.value = (INTENSITY_BASE + lvl.current * INTENSITY_GAIN) * (softBloom ? RADIO_EDGE_BOOST : 1)
    // Morph the single Bloom toward the frosted (radio) look, eased over ~0.2s; its radio intensity follows the music.
    fade.current += ((softBloom ? 1 : 0) - fade.current) * (1 - Math.exp(-dt / SOFT_FADE_TAU))
    const f = fade.current
    softLvl.current += (Math.min(1, Math.sqrt(level * SOFT_LEVEL_GAIN)) - softLvl.current) * SOFT_LEVEL_SMOOTH
    const radioIntensity = SOFT_BASE + SOFT_GAIN * softLvl.current
    bloom.luminanceMaterial.threshold = BLOOM_THRESHOLD + (SOFT_THRESHOLD - BLOOM_THRESHOLD) * f
    bloom.mipmapBlurPass.radius = BLOOM_RADIUS + (SOFT_RADIUS - BLOOM_RADIUS) * f
    bloom.intensity = BLOOM_INTENSITY + (radioIntensity - BLOOM_INTENSITY) * f
  })

  // HDR buffer (HalfFloat): the edge effect makes the orb outline brighter than 1.0; the Bloom turns that into a glow
  // (and, in radio, also the whole scene). One composer, fixed 3 passes — nothing added/removed → no recompile/freeze.
  return (
    <EffectComposer enabled={enabled} frameBufferType={HalfFloatType}>
      <primitive object={pass} />
      <primitive object={edgePass} />
      <primitive object={bloomPass} />
    </EffectComposer>
  )
}
