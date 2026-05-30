import { useRef, useState, useEffect } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import { Arena, randomArenaPos } from './Arena'
import { useGameInput } from './useGameInput'

interface Afterglow {
  start: THREE.Vector3
  end: THREE.Vector3
  opacity: number
}

interface Particle {
  pos: THREE.Vector3
  vel: THREE.Vector3
  life: number
}

interface GameProps {
  setBeamProgress: (v: number) => void
  setShieldProgress: (v: number) => void
  setShieldVisible: (v: boolean) => void
  triggerBeamFlash: () => void
  triggerPlayerHit: () => void
  setWindupProgress: (v: number) => void
  triggerShieldBlock: () => void
  triggerBotShieldHit: () => void
}

const BEAM_COOLDOWN      = 1500
const BEAM_DURATION      = 200  // полная длительность fade-out луча
const BEAM_WINDUP        = 400
const WINDUP_MOVE_FACTOR = 0.25
const WINDUP_LOOK_FACTOR = 0.15
const SHIELD_DURATION    = 800
const SHIELD_COOLDOWN    = 2000
const MOVE_SPEED         = 7
const EYE_HEIGHT         = 1.7
const JUMP_FORCE         = 8
const GRAVITY            = -22

const isStatic = new URLSearchParams(window.location.search).has('static')

// Вычисляет start луча: уровень груди игрока, чуть вправо
function chestStart(cam: THREE.Camera): THREE.Vector3 {
  const dir = new THREE.Vector3()
  cam.getWorldDirection(dir)
  dir.y = 0
  dir.normalize()
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
  return cam.position.clone()
    .add(new THREE.Vector3(0, -0.85, 0))   // уровень груди
    .addScaledVector(right, 0.8)           // чуть вправо (оружие)
    .addScaledVector(dir, 0.1)             // чуть вперёд от тела
}

export function Game({ setBeamProgress, setShieldProgress, setShieldVisible, triggerBeamFlash, triggerPlayerHit, setWindupProgress, triggerShieldBlock, triggerBotShieldHit }: GameProps) {
  const { camera, scene } = useThree()
  const keys = useGameInput()

  const targetRef      = useRef<THREE.Mesh>(null)
  const botRespawnRef  = useRef<(() => void) | null>(null)
  const shieldMeshRef  = useRef<THREE.Mesh>(null)
  const controlsRef    = useRef<any>(null)
  const beamGroupRef   = useRef<THREE.Group>(null!)  // императивное управление лучом
  const beamActiveRef  = useRef(false)
  const beamEndRef     = useRef<THREE.Vector3 | null>(null)

  const beamFireTime    = useRef(0)
  const beamWindup      = useRef(false)
  const beamCooldown    = useRef(false)
  const beamCooldownEnd = useRef(0)
  const shieldActive    = useRef(false)
  const shieldCooldown  = useRef(false)
  const shieldCooldownEnd = useRef(0)
  const lastHudUpdate   = useRef(0)
  const velocityY       = useRef(0)
  const onGround        = useRef(true)
  const shakeFrames     = useRef(0)
  const spectatorMode   = useRef(false)
  const frozenPlayerPos = useRef(new THREE.Vector3())
  const ORBIT_RADIUS    = 5

  const windupStartTime  = useRef(0)
  const prevWindupActive = useRef(false)
  const botShieldActive  = useRef(false)

  const beamWindupTimerId    = useRef<ReturnType<typeof setTimeout> | null>(null)
  const beamCooldownTimerId  = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shieldDurationTimerId = useRef<ReturnType<typeof setTimeout> | null>(null)
  const shieldCooldownTimerId = useRef<ReturnType<typeof setTimeout> | null>(null)
  const executeBeamFireRef   = useRef<(() => void) | null>(null)

  const [isSpectator, setIsSpectator] = useState(false)
  const [afterglow, setAfterglow] = useState<Afterglow | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const [, forceParticleRender] = useState(0)

  useEffect(() => {
    const geo = new THREE.SphereGeometry(0.9, 16, 16)
    const mat = new THREE.MeshStandardMaterial({ color: 'royalblue', transparent: true, opacity: 0.3, side: THREE.DoubleSide })
    const shield = new THREE.Mesh(geo, mat)
    shield.userData.noRaycast = true
    shield.visible = false
    shieldMeshRef.current = shield
    camera.add(shield)
    return () => { camera.remove(shield); geo.dispose(); mat.dispose() }
  }, [camera])

  useEffect(() => {
    const releaseFire = () => {
      beamWindupTimerId.current = null
      beamWindup.current = false
      if (controlsRef.current) controlsRef.current.pointerSpeed = 1.0

      const dir = new THREE.Vector3()
      camera.getWorldDirection(dir)

      const targets: THREE.Object3D[] = []
      scene.traverse((obj) => {
        if (obj instanceof THREE.Mesh && !obj.userData.noRaycast) targets.push(obj)
      })

      const rayOrigin = camera.position.clone()
      const raycaster = new THREE.Raycaster(rayOrigin, dir)
      const hits = raycaster.intersectObjects(targets)

      let end: THREE.Vector3
      let hitPoint: THREE.Vector3 | null = null

      if (hits.length > 0) {
        end = hits[0].point.clone()
        hitPoint = end.clone()
        if (hits[0].object.name === 'target') {
          if (botShieldActive.current) {
            triggerBotShieldHit()
          } else {
            ;(window as any).__debugTargetHitCount = ((window as any).__debugTargetHitCount ?? 0) + 1
            particlesRef.current = Array.from({ length: 6 }, () => ({
              pos: hitPoint!.clone(),
              vel: new THREE.Vector3(
                (Math.random() - 0.5) * 8,
                Math.random() * 6,
                (Math.random() - 0.5) * 8,
              ),
              life: 1.0,
            }))
            botRespawnRef.current?.()
          }
        }
      } else {
        end = rayOrigin.clone().addScaledVector(dir, 100)
      }

      triggerBeamFlash()
      shakeFrames.current = 5

      beamEndRef.current = end
      beamActiveRef.current = true
      beamFireTime.current = Date.now()

      const glowStart = chestStart(camera)
      setAfterglow({ start: glowStart, end: end.clone(), opacity: 0.5 })

      beamCooldown.current = true
      beamCooldownEnd.current = Date.now() + BEAM_COOLDOWN
      beamCooldownTimerId.current = setTimeout(() => {
        beamCooldownTimerId.current = null
        beamCooldown.current = false
      }, BEAM_COOLDOWN)
    }

    executeBeamFireRef.current = releaseFire

    const fireBeam = () => {
      if (beamCooldown.current || beamWindup.current) return
      if (!document.pointerLockElement) return

      beamWindup.current = true
      windupStartTime.current = Date.now()
      if (controlsRef.current) controlsRef.current.pointerSpeed = WINDUP_LOOK_FACTOR

      beamWindupTimerId.current = setTimeout(releaseFire, BEAM_WINDUP)
    }

    const activateShield = () => {
      if (shieldCooldown.current || shieldActive.current) return
      if (!document.pointerLockElement) return
      shieldActive.current = true
      setShieldVisible(true)
      if (shieldMeshRef.current) shieldMeshRef.current.visible = true
      shieldCooldownEnd.current = Date.now() + SHIELD_DURATION + SHIELD_COOLDOWN
      shieldDurationTimerId.current = setTimeout(() => {
        shieldDurationTimerId.current = null
        shieldActive.current = false
        setShieldVisible(false)
        if (shieldMeshRef.current) shieldMeshRef.current.visible = false
        shieldCooldown.current = true
      }, SHIELD_DURATION)
      shieldCooldownTimerId.current = setTimeout(() => {
        shieldCooldownTimerId.current = null
        shieldCooldown.current = false
      }, SHIELD_DURATION + SHIELD_COOLDOWN)
    }

    const onMouseDown = (e: MouseEvent) => {
      if (e.button === 0) fireBeam()
      if (e.button === 2) activateShield()
    }
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
        e.preventDefault()
        if (onGround.current && !spectatorMode.current) { velocityY.current = JUMP_FORCE; onGround.current = false }
      }
      if (e.key === 'v' || e.key === 'V') {
        const entering = !spectatorMode.current
        spectatorMode.current = entering
        setIsSpectator(entering)
        if (entering) {
          frozenPlayerPos.current.copy(camera.position)
        } else {
          // Возвращаем игрока точно на замороженную позицию
          camera.position.copy(frozenPlayerPos.current)
          velocityY.current = 0
          onGround.current = frozenPlayerPos.current.y <= EYE_HEIGHT + 0.01
        }
      }
    }
    const onContextMenu = (e: MouseEvent) => e.preventDefault()

    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('contextmenu', onContextMenu)
    return () => {
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('contextmenu', onContextMenu)
    }
  }, [camera, scene, setShieldVisible, triggerBeamFlash, triggerShieldBlock, triggerBotShieldHit])

  useEffect(() => {
    const w = window as any
    w.__debugCamera = camera
    w.__debugWindup = () => beamWindup.current
    w.__debugTargetHitCount = 0
    return () => { delete w.__debugCamera; delete w.__debugWindup; delete w.__debugTargetHitCount }
  }, [camera])

  useEffect(() => { camera.rotation.set(0, 0, 0) }, [camera])

  useFrame((state, delta) => {
    const k = keys.current
    const cam = state.camera
    const dir = new THREE.Vector3()
    cam.getWorldDirection(dir)
    dir.y = 0
    dir.normalize()
    const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()

    const physicsDelta = beamWindup.current ? delta * WINDUP_MOVE_FACTOR : delta

    if (!spectatorMode.current) {
      if (k.forward) cam.position.addScaledVector(dir, MOVE_SPEED * physicsDelta)
      if (k.back)    cam.position.addScaledVector(dir, -MOVE_SPEED * physicsDelta)
      if (k.left)    cam.position.addScaledVector(right, -MOVE_SPEED * physicsDelta)
      if (k.right)   cam.position.addScaledVector(right, MOVE_SPEED * physicsDelta)

      if (!onGround.current) {
        velocityY.current += GRAVITY * physicsDelta
        cam.position.y += velocityY.current * physicsDelta
      }
      if (cam.position.y <= EYE_HEIGHT) {
        cam.position.y = EYE_HEIGHT
        velocityY.current = 0
        onGround.current = true
      }
    } else {
      // Spectator: камера орбитует вокруг замороженной позиции игрока
      const spectDir = new THREE.Vector3()
      cam.getWorldDirection(spectDir)
      cam.position.copy(frozenPlayerPos.current).addScaledVector(spectDir, -ORBIT_RADIUS)
    }

    // Dynamic FOV
    const isMoving = k.forward || k.back || k.left || k.right
    const targetFov = spectatorMode.current ? 75 : (beamWindup.current ? 70 : (isMoving ? 87 : 75))
    const pcam = cam as THREE.PerspectiveCamera
    pcam.fov = THREE.MathUtils.lerp(pcam.fov, targetFov, delta * 6)
    pcam.updateProjectionMatrix()

    // Camera shake
    if (shakeFrames.current > 0) {
      cam.position.x += (Math.random() - 0.5) * 0.04
      cam.position.y += (Math.random() - 0.5) * 0.04
      shakeFrames.current--
    }


    // Луч: каждый кадр пересчитываем start из текущей позиции камеры + fade radius
    if (beamGroupRef.current) {
      if (beamActiveRef.current && beamEndRef.current) {
        const elapsed = Date.now() - beamFireTime.current
        const t = Math.min(elapsed / BEAM_DURATION, 1)
        const radiusScale = 1 - t  // сужается к нулю

        if (t >= 1) {
          beamActiveRef.current = false
          beamGroupRef.current.visible = false
        } else {
          const start = chestStart(cam)
          const beamDir = beamEndRef.current.clone().sub(start)
          const len = beamDir.length()
          const mid = start.clone().lerp(beamEndRef.current, 0.5)
          const quat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), beamDir.normalize()
          )
          beamGroupRef.current.position.copy(mid)
          beamGroupRef.current.quaternion.copy(quat)
          beamGroupRef.current.scale.set(radiusScale, len, radiusScale)
          beamGroupRef.current.visible = true
        }
      } else {
        beamGroupRef.current.visible = false
      }
    }

    // Afterglow fade
    if (afterglow) {
      const nextOpacity = afterglow.opacity - delta * 1.8
      if (nextOpacity <= 0) {
        setAfterglow(null)
      } else {
        setAfterglow(prev => prev ? { ...prev, opacity: nextOpacity } : null)
      }
    }

    // Particles
    if (particlesRef.current.length > 0) {
      particlesRef.current = particlesRef.current
        .map(p => ({
          pos: p.pos.clone().addScaledVector(p.vel, delta),
          vel: new THREE.Vector3(p.vel.x, p.vel.y + GRAVITY * delta, p.vel.z),
          life: p.life - delta * 3,
        }))
        .filter(p => p.life > 0)
      forceParticleRender(n => n + 1)
    }

    // HUD
    const now = Date.now()
    if (now - lastHudUpdate.current > 50) {
      lastHudUpdate.current = now
      const beamP = beamCooldown.current ? Math.max(0, 1 - (beamCooldownEnd.current - now) / BEAM_COOLDOWN) : 1
      setBeamProgress(beamP)
      const totalShieldTime = SHIELD_DURATION + SHIELD_COOLDOWN
      const shieldP = shieldActive.current || shieldCooldown.current
        ? Math.max(0, 1 - (shieldCooldownEnd.current - now) / totalShieldTime) : 1
      setShieldProgress(shieldP)
    }

    // Windup progress → App.tsx 2D overlay
    if (beamWindup.current) {
      const windupP = Math.min((now - windupStartTime.current) / BEAM_WINDUP, 1)
      setWindupProgress(windupP)
      prevWindupActive.current = true
    } else if (prevWindupActive.current) {
      setWindupProgress(0)
      prevWindupActive.current = false
    }

  })

  return (
    <>
      <PointerLockControls ref={controlsRef} />
      <Arena
        targetRef={targetRef}
        botRespawnRef={botRespawnRef}
        isStatic={isStatic}
        camera={camera}
        isShieldActive={() => shieldActive.current}
        onPlayerHit={() => {
          // Если игрок умирает в момент заряда — луч всё равно летит
          if (beamWindupTimerId.current) {
            clearTimeout(beamWindupTimerId.current)
            beamWindupTimerId.current = null
            executeBeamFireRef.current?.()
          }
          if (beamCooldownTimerId.current)  { clearTimeout(beamCooldownTimerId.current);  beamCooldownTimerId.current  = null }
          if (shieldDurationTimerId.current){ clearTimeout(shieldDurationTimerId.current); shieldDurationTimerId.current = null }
          if (shieldCooldownTimerId.current){ clearTimeout(shieldCooldownTimerId.current); shieldCooldownTimerId.current = null }

          const spawnPos = randomArenaPos()
          camera.position.set(spawnPos.x, EYE_HEIGHT, spawnPos.z)
          velocityY.current = 0
          onGround.current = true
          beamWindup.current = false
          beamCooldown.current = false
          shieldActive.current = false
          shieldCooldown.current = false
          setShieldVisible(false)
          if (shieldMeshRef.current) shieldMeshRef.current.visible = false
          prevWindupActive.current = false
          setWindupProgress(0)
          if (controlsRef.current) controlsRef.current.pointerSpeed = 1.0
          triggerPlayerHit()
        }}
        onShieldBlock={() => triggerShieldBlock()}
        onBotShieldChange={(active) => { botShieldActive.current = active }}
      />

      {/* Луч (Wide Cylinder) — imperatively updated in useFrame */}
      <group ref={beamGroupRef} visible={false}>
        <mesh>
          <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
          <meshBasicMaterial color="white" />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.15, 0.15, 1, 8]} />
          <meshBasicMaterial color="#0ff" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>

      {/* Afterglow */}
      {afterglow && (() => {
        const dir = afterglow.end.clone().sub(afterglow.start)
        const len = dir.length()
        const mid = afterglow.start.clone().lerp(afterglow.end, 0.5)
        const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize())
        return (
          <group position={mid} quaternion={quat} scale={[1, len, 1]}>
            <mesh>
              <cylinderGeometry args={[0.1, 0.1, 1, 8]} />
              <meshBasicMaterial color="#0ff" transparent opacity={afterglow.opacity * 0.4} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
          </group>
        )
      })()}

      {/* Осколки */}
      {particlesRef.current.map((p, i) => (
        <mesh key={i} position={p.pos} scale={p.life * 0.15}>
          <sphereGeometry args={[1, 4, 4]} />
          <meshBasicMaterial color="#ff0" />
        </mesh>
      ))}

      {/* Spectator: светящийся шар на месте игрока */}
      {isSpectator && (
        <group position={frozenPlayerPos.current.toArray() as [number, number, number]}>
          <mesh>
            <sphereGeometry args={[0.4, 16, 16]} />
            <meshBasicMaterial color="#4af" />
          </mesh>
        </group>
      )}
    </>
  )
}
