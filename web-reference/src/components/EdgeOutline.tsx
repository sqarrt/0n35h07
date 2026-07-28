import { forwardRef, useEffect, useMemo } from 'react'
import { useThree } from '@react-three/fiber'
import { EffectComposer } from '@react-three/postprocessing'
import { Effect, EffectAttribute, NormalPass } from 'postprocessing'
import { DepthTexture, Uniform, Vector2, WebGLRenderTarget } from 'three'
import type { Camera, Scene, Texture, WebGLRenderer, WebGLRenderTarget as RT } from 'three'

/**
 * Screen-space outline of visible edges ONLY on blocks (cubes/wedges on BLOCK_LAYER).
 * Blocks are rendered into a separate normals+depth buffer (a layer-limited NormalPass). An edge = a normal
 * discontinuity between neighboring pixels, BUT only where the block is actually visible: its depth matches the
 * scene's (not occluded by player/wall). Floor/walls/players aren't on the layer → absent from the buffer, the
 * outline doesn't touch them; occluded blocks aren't highlighted either. Edge color = block's frame color, lightened.
 */
export const BLOCK_LAYER = 1

const THICKNESS = 1.0     // sampling thickness in SCREEN px → constant at any distance; thinner
const THRESH = 0.1        // threshold for the sum of neighbor normal distances
const GAIN = 2.0          // how many times lighter the block color is on the edge
const DEPTH_EPS = 0.15    // depth-compare tolerance in WORLD units (via getViewZ) — no bleeding onto the player

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
  float isBlock = step(blockD, 0.9999);                          // this pixel has a block (not the far plane)
  // Visible if the scene isn't closer than the block by more than eps (world units) — otherwise block is occluded by player/wall.
  float visible = step(getViewZ(depth) - getViewZ(blockD), uDepthEps);

  float edge = isBlock * visible * smoothstep(uThresh, uThresh * 2.0, dN);
  vec3 lighter = min(inputColor.rgb * uGain, vec3(1.0));
  outputColor = vec4(mix(inputColor.rgb, lighter, edge), inputColor.a);
}
`

/** NormalPass rendering ONLY the blocks layer. We restrict every camera the internal renderPass might render
 * with (this.camera / renderPass.camera / renderPass.mainCamera) to BLOCK_LAYER. */
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

/** Composer with the block NormalPass (+depth) and the outline effect. Mounted inside Canvas. */
export const MapEdges = forwardRef<unknown>(function MapEdges(_props, _ref) {
  const scene = useThree(s => s.scene)
  const camera = useThree(s => s.camera)
  const size = useThree(s => s.size)

  // Own RT with a depthTexture — so the block pass has both the normal and the blocks' depth.
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
