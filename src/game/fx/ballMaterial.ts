import * as THREE from 'three'
import {
  BALL_RADIUS, BALL_WAVE_COUNT, BALL_WAVE_AMP, BALL_WAVE_SPEED,
  BALL_RING_INNER, BALL_RING_OUTER, BALL_RING_TILT_DEG, BALL_RING_SEGMENTS, BALL_RING_BANDS, BALL_RING_SCROLL,
} from '../../constants'
import type { BallModel } from '../../constants'

/** GLSL-литерал float из TS-константы (без магических чисел в шейдере). */
const f = (n: number) => n.toFixed(6)
const PI = Math.PI

/** Деформация вершин сферы (только модель waves; вставляется после begin_vertex). */
function wavesGLSL(): string {
  // Плотные бегущие волны: COUNT циклов по высоте 2·R → коэффициент частоты = COUNT·π/R.
  const freq = BALL_WAVE_COUNT * PI / BALL_RADIUS
  return `transformed += objectNormal * ${f(BALL_WAVE_AMP)} * sin(${f(freq)} * position.y + uTime * ${f(BALL_WAVE_SPEED)});`
}

/**
 * Материал сферы по модели. Базируется на MeshStandardMaterial (свет/цвет/прозрачность/масштаб как раньше —
 * windup/призрак); для `waves` добавляет деформацию вершин + uniform времени. `tick(dt)` крутит время.
 * Общая фабрика для боевого тела (`Body`) и превью (`BallPreview`). Для `planet` сфера ровная — кольцо отдельно.
 */
export function createBallMaterial(color: string, model: BallModel) {
  const material = new THREE.MeshStandardMaterial({ color, transparent: true })
  const uTime = { value: 0 }
  if (model === 'waves') {
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uTime
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n' + wavesGLSL(),
      )
    }
    material.customProgramCacheKey = () => 'ball-waves'
  }
  return { material, tick: (dt: number) => { uTime.value += dt } }
}

/**
 * Кольцо планеты (модель `planet`): плоский annulus с радиальным градиентом в цвете игрока (банды + мягкое
 * затухание по краям, лёгкий дрейф). Unlit ShaderMaterial, полупрозрачное, наклонённое, `noRaycast` (на боёвку
 * не влияет). `tick(dt)` дрейфит банды; `setOpacity(o)` — для призрака/материализации.
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
  mesh.renderOrder = 1   // рисуем кольцо ПОСЛЕ прозрачной сферы (детерминированно): зад отсекает глубина, перед ложится поверх
  return {
    mesh,
    tick: (dt: number) => { uTime.value += dt },
    setOpacity: (o: number) => { uOpacity.value = o },
    setColor: (c: THREE.Color) => { uColor.value.copy(c) },
    lerpColor: (c: THREE.Color, t: number) => { uColor.value.lerp(c, t) },
    dispose: () => { mesh.geometry.dispose(); material.dispose() },
  }
}
