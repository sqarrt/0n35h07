import * as THREE from 'three'
import {
  BALL_RADIUS, BALL_WAVE_COUNT, BALL_WAVE_AMP, BALL_WAVE_SPEED,
  BALL_RING_INNER, BALL_RING_OUTER, BALL_RING_TILT_DEG, BALL_RING_SEGMENTS, BALL_RING_BANDS, BALL_RING_SCROLL,
} from '../../constants'
import type { BallModel } from '../../constants'
import { buildArtTexture, writeArtData } from './artTexture'
import type { BallArt } from '../ballArt'

/** GLSL float literal from a TS constant (no magic numbers in the shader). */
const f = (n: number) => n.toFixed(6)
const PI = Math.PI

/** Sphere vertex deformation (waves model only; injected after begin_vertex). */
function wavesGLSL(): string {
  // Dense travelling waves: COUNT cycles over height 2·R → frequency factor = COUNT·π/R.
  const freq = BALL_WAVE_COUNT * PI / BALL_RADIUS
  return `transformed += objectNormal * ${f(BALL_WAVE_AMP)} * sin(${f(freq)} * position.y + uTime * ${f(BALL_WAVE_SPEED)});`
}

// GLSL disc sampling of the art (injected into the fragment after color_fragment): model normal →
// hemisphere (front/back) → radius from the pole → sample from the 64×32 texture → multiplier into diffuse.
// White texel (1) → ball color, black (0) → art. The sampler is ALWAYS enabled (empty = white texture).
const ART_FRAGMENT_GLSL = `
{
  vec3 nrm = normalize(vArtNormal);
  float isFront = step(nrm.z, 0.0);
  float ang = acos(clamp(abs(nrm.z), 0.0, 1.0));
  float rad = ang / ${f(Math.PI / 2)};
  float phi = atan(nrm.y, mix(nrm.x, -nrm.x, isFront));
  vec2 disc = vec2(0.5 + 0.5 * rad * cos(phi), 0.5 + 0.5 * rad * sin(phi));
  float au = disc.x * 0.5 + (1.0 - isFront) * 0.5;
  float art = texture2D(uArt, vec2(au, disc.y)).r;
  diffuseColor.rgb *= art;
}
`

/**
 * Sphere material by model + an ALWAYS-enabled art sampler (white texture = no art → multiplier 1;
 * this avoids rebuilding the material on the empty↔non-empty transition in the live preview). `waves` adds
 * vertex deformation. `tick(dt)` advances wave time; `setArt(art)` updates the art in place; `dispose()` — the texture.
 * Shared factory for the combat body (`Body`) and the preview (`StageBall`). For `planet` the sphere is plain — the ring is separate.
 */
export function createBallMaterial(color: string, model: BallModel, art?: BallArt) {
  const material = new THREE.MeshStandardMaterial({ color, transparent: true })
  const uTime = { value: 0 }
  const artTexture = buildArtTexture(art ?? null)
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uArt = { value: artTexture }
    // Vertex: pass through the model normal (+ wave deformation for waves only).
    let vert = 'varying vec3 vArtNormal;\n' + shader.vertexShader
    vert = vert.replace('#include <beginnormal_vertex>', '#include <beginnormal_vertex>\n  vArtNormal = objectNormal;')
    if (model === 'waves') {
      shader.uniforms.uTime = uTime
      vert = 'uniform float uTime;\n' + vert
      vert = vert.replace('#include <begin_vertex>', '#include <begin_vertex>\n' + wavesGLSL())
    }
    shader.vertexShader = vert
    // Fragment: disc sampling of the art and multiplication into diffuse.
    shader.fragmentShader = 'uniform sampler2D uArt;\nvarying vec3 vArtNormal;\n' + shader.fragmentShader.replace(
      '#include <color_fragment>',
      '#include <color_fragment>\n' + ART_FRAGMENT_GLSL,
    )
  }
  material.customProgramCacheKey = () => `ball-${model}-art`
  return {
    material,
    artTexture,
    tick: (dt: number) => { uTime.value += dt },
    setArt: (next: BallArt | null) => {
      writeArtData(next, artTexture.image.data as Uint8Array)
      artTexture.needsUpdate = true
    },
    dispose: () => { artTexture.dispose() },
  }
}

/**
 * Planet ring (model `planet`): a flat annulus with a radial gradient in the player color (bands + soft
 * edge falloff, slight drift). Unlit ShaderMaterial, semi-transparent, tilted, `noRaycast` (doesn't affect
 * combat). `tick(dt)` drifts the bands; `setOpacity(o)` — for the ghost/materialization.
 */
export function createBallRing(color: string) {
  const uTime = { value: 0 }
  const uOpacity = { value: 1 }
  const uColor = { value: new THREE.Color(color) }
  const material = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide,
    uniforms: { uColor, uOpacity, uTime },
    vertexShader: `
      varying float vT;
      void main() {
        vT = (length(position.xy) - ${f(BALL_RING_INNER)}) / ${f(BALL_RING_OUTER - BALL_RING_INNER)};
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: `
      varying float vT;
      uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
      void main() {
        float edge = smoothstep(0.0, 0.12, vT) * smoothstep(1.0, 0.82, vT);
        float bands = 0.6 + 0.4 * sin(vT * ${f(2 * PI * BALL_RING_BANDS)} - uTime * ${f(BALL_RING_SCROLL)});
        vec3 c = uColor * (0.75 + 0.5 * vT);
        gl_FragColor = vec4(c, edge * bands * uOpacity);
      }`,
  })
  const mesh = new THREE.Mesh(
    new THREE.RingGeometry(BALL_RING_INNER, BALL_RING_OUTER, BALL_RING_SEGMENTS),
    material,
  )
  mesh.rotation.x = THREE.MathUtils.degToRad(BALL_RING_TILT_DEG)
  mesh.castShadow = false
  mesh.userData.noRaycast = true
  mesh.renderOrder = 1   // draw the ring AFTER the transparent sphere (deterministic): depth culls the back, the front lies on top
  return {
    mesh,
    tick: (dt: number) => { uTime.value += dt },
    setOpacity: (o: number) => { uOpacity.value = o },
    setColor: (c: THREE.Color) => { uColor.value.copy(c) },
    lerpColor: (c: THREE.Color, t: number) => { uColor.value.lerp(c, t) },
    dispose: () => { mesh.geometry.dispose(); material.dispose() },
  }
}
