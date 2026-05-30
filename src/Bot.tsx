import { RefObject, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { randomArenaPos } from './Arena'

interface BotProps {
  targetRef: RefObject<THREE.Mesh | null>
  botRespawnRef: RefObject<(() => void) | null>
  camera: THREE.Camera
  isShieldActive: () => boolean
  onPlayerHit: () => void
  isStatic?: boolean
  windupStyle: number
}

const TARGET_SPEED      = 2.5
const BOT_FIRE_INTERVAL = 2500
const BOT_WINDUP        = 600
const BEAM_DURATION     = 200

const BASE_COLOR  = new THREE.Color('#5af')
const WHITE_COLOR = new THREE.Color('#fff')

function getInitialBotPos(): THREE.Vector3 {
  const param = new URLSearchParams(window.location.search).get('targetPos')
  if (param) {
    const [x, y, z] = param.split(',').map(Number)
    return new THREE.Vector3(x, y, z)
  }
  return randomArenaPos()
}

export function Bot({ targetRef, botRespawnRef, camera, isShieldActive, onPlayerHit, isStatic = false, windupStyle }: BotProps) {
  const { scene } = useThree()

  const groupRef        = useRef<THREE.Group>(null!)
  const bodyMeshRef     = useRef<THREE.Mesh>(null!)
  const bodyMatRef      = useRef<THREE.MeshStandardMaterial>(null!)
  const auraMatRef      = useRef<THREE.MeshBasicMaterial>(null!)
  const botLaserGroupRef = useRef<THREE.Group>(null!)
  const waypointRef     = useRef<THREE.Vector3>(randomArenaPos())
  const initPos         = useRef(getInitialBotPos())

  const shootTimer  = useRef(0)
  const isWindingUp = useRef(false)
  const windupTimer = useRef(0)

  const beamGroupRef  = useRef<THREE.Group>(null!)
  const beamActiveRef = useRef(false)
  const beamFireTime  = useRef(0)
  const beamStartRef  = useRef(new THREE.Vector3())
  const beamEndRef    = useRef(new THREE.Vector3())

  const resetWindupVisuals = () => {
    if (auraMatRef.current)       auraMatRef.current.opacity = 0
    if (botLaserGroupRef.current) botLaserGroupRef.current.visible = false
    if (bodyMatRef.current)       bodyMatRef.current.color.copy(BASE_COLOR)
    if (bodyMeshRef.current)      bodyMeshRef.current.scale.setScalar(1)
  }

  useEffect(() => {
    botRespawnRef.current = () => {
      if (!groupRef.current || !bodyMatRef.current) return
      isWindingUp.current = false
      windupTimer.current = 0
      shootTimer.current  = 0
      // Reset windup visuals immediately
      if (auraMatRef.current)       auraMatRef.current.opacity = 0
      if (botLaserGroupRef.current) botLaserGroupRef.current.visible = false
      if (bodyMeshRef.current)      bodyMeshRef.current.scale.setScalar(1)
      // Flash red, then teleport
      bodyMatRef.current.color.set('red')
      setTimeout(() => {
        if (!bodyMatRef.current || !groupRef.current) return
        bodyMatRef.current.color.copy(BASE_COLOR)
        groupRef.current.position.copy(randomArenaPos())
        waypointRef.current = randomArenaPos()
      }, 150)
    }
    return () => { botRespawnRef.current = null }
  }, [botRespawnRef])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const pos = groupRef.current.position

    // Movement
    if (!isStatic && !isWindingUp.current) {
      const wp = waypointRef.current
      const dx = wp.x - pos.x
      const dz = wp.z - pos.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < 0.5) {
        waypointRef.current = randomArenaPos()
      } else {
        pos.x += (dx / dist) * TARGET_SPEED * delta
        pos.z += (dz / dist) * TARGET_SPEED * delta
      }
    }

    // Sync hitbox
    if (targetRef.current) {
      targetRef.current.position.copy(pos)
    }

    // Shoot timer + windup (fully in useFrame for animated visuals)
    if (!isStatic) {
      if (!isWindingUp.current) {
        shootTimer.current += delta * 1000
        if (shootTimer.current >= BOT_FIRE_INTERVAL) {
          shootTimer.current = 0
          isWindingUp.current = true
          windupTimer.current = 0
        }
      } else {
        windupTimer.current += delta * 1000
        const windupP = Math.min(windupTimer.current / BOT_WINDUP, 1)

        // --- Windup visuals ---
        if (windupStyle === 1) {
          // Style 1: aura sphere grows in opacity
          if (auraMatRef.current) auraMatRef.current.opacity = windupP * 0.55
          if (botLaserGroupRef.current) botLaserGroupRef.current.visible = false
          if (bodyMatRef.current) bodyMatRef.current.color.copy(BASE_COLOR)
          if (bodyMeshRef.current) bodyMeshRef.current.scale.setScalar(1)
        } else if (windupStyle === 2) {
          // Style 2: laser sight from bot chest to player
          if (auraMatRef.current) auraMatRef.current.opacity = 0
          const botChest = pos.clone().add(new THREE.Vector3(0, 0.5, 0))
          const playerPos = camera.position.clone()
          const laserDir = playerPos.clone().sub(botChest)
          const len = laserDir.length()
          if (len > 0.1 && botLaserGroupRef.current) {
            const mid  = botChest.clone().lerp(playerPos, 0.5)
            const quat = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0), laserDir.normalize()
            )
            botLaserGroupRef.current.position.copy(mid)
            botLaserGroupRef.current.quaternion.copy(quat)
            botLaserGroupRef.current.scale.set(1, len, 1)
            botLaserGroupRef.current.visible = true
          }
          if (bodyMatRef.current) bodyMatRef.current.color.copy(BASE_COLOR)
          if (bodyMeshRef.current) bodyMeshRef.current.scale.setScalar(1)
        } else {
          // Style 3: body colour lerps to white, sphere scales up
          if (auraMatRef.current) auraMatRef.current.opacity = 0
          if (botLaserGroupRef.current) botLaserGroupRef.current.visible = false
          if (bodyMatRef.current) bodyMatRef.current.color.lerpColors(BASE_COLOR, WHITE_COLOR, windupP)
          if (bodyMeshRef.current) bodyMeshRef.current.scale.setScalar(1 + windupP * 0.4)
        }

        // Fire when windup complete
        if (windupP >= 1) {
          isWindingUp.current = false
          windupTimer.current = 0
          resetWindupVisuals()

          const botChest = pos.clone().add(new THREE.Vector3(0, 0.5, 0))
          const playerPos = camera.position.clone()
          const dir = playerPos.clone().sub(botChest).normalize()

          const obstacles: THREE.Object3D[] = []
          scene.traverse(obj => {
            if (obj instanceof THREE.Mesh && obj.name !== 'target' && !obj.userData.noRaycast && !obj.userData.botBeam) {
              obstacles.push(obj)
            }
          })
          const ray = new THREE.Raycaster(botChest, dir)
          const hits = ray.intersectObjects(obstacles)
          const distToPlayer = botChest.distanceTo(playerPos)
          const blocked = hits.length > 0 && hits[0].distance < distToPlayer

          beamStartRef.current.copy(botChest)
          beamEndRef.current.copy(blocked ? hits[0].point : playerPos)
          beamActiveRef.current = true
          beamFireTime.current = Date.now()

          if (!blocked && !isShieldActive()) {
            onPlayerHit()
          }
        }
      }
    }

    // Beam fade-out
    if (beamGroupRef.current) {
      if (beamActiveRef.current) {
        const elapsed = Date.now() - beamFireTime.current
        const t = Math.min(elapsed / BEAM_DURATION, 1)
        if (t >= 1) {
          beamActiveRef.current = false
          beamGroupRef.current.visible = false
        } else {
          const start = beamStartRef.current
          const end   = beamEndRef.current
          const beamDir = end.clone().sub(start)
          const len = beamDir.length()
          const mid = start.clone().lerp(end, 0.5)
          const quat = new THREE.Quaternion().setFromUnitVectors(
            new THREE.Vector3(0, 1, 0), beamDir.normalize()
          )
          beamGroupRef.current.position.copy(mid)
          beamGroupRef.current.quaternion.copy(quat)
          beamGroupRef.current.scale.set(1 - t, len, 1 - t)
          beamGroupRef.current.visible = true
        }
      } else {
        beamGroupRef.current.visible = false
      }
    }
  })

  return (
    <>
      {/* Invisible hitbox */}
      <mesh
        ref={targetRef}
        position={initPos.current.toArray() as [number, number, number]}
        name="target"
        visible={false}
      >
        <boxGeometry args={[1, 2, 1]} />
        <meshStandardMaterial />
      </mesh>

      {/* Bot model */}
      <group ref={groupRef} position={initPos.current.toArray() as [number, number, number]}>
        {/* Body sphere (Style 3: scales + color lerp) */}
        <mesh ref={bodyMeshRef} position={[0, 0.5, 0]} castShadow userData={{ noRaycast: true }}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial ref={bodyMatRef} color="#5af" />
        </mesh>
        {/* Ambient glow */}
        <mesh position={[0, 0.5, 0]} userData={{ noRaycast: true }}>
          <sphereGeometry args={[0.75, 16, 16]} />
          <meshBasicMaterial color="#5af" transparent opacity={0.15} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
        {/* Style 1: aura sphere */}
        <mesh position={[0, 0.5, 0]} userData={{ noRaycast: true }}>
          <sphereGeometry args={[1.1, 16, 16]} />
          <meshBasicMaterial ref={auraMatRef} color="#f44" transparent opacity={0} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>

      {/* Style 2: bot laser sight */}
      <group ref={botLaserGroupRef} visible={false} userData={{ noRaycast: true, botBeam: true }}>
        <mesh>
          <cylinderGeometry args={[0.02, 0.02, 1, 6]} />
          <meshBasicMaterial color="#f84" transparent opacity={0.7} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>

      {/* Beam */}
      <group ref={beamGroupRef} visible={false} userData={{ botBeam: true }}>
        <mesh>
          <cylinderGeometry args={[0.05, 0.05, 1, 8]} />
          <meshBasicMaterial color="white" />
        </mesh>
        <mesh>
          <cylinderGeometry args={[0.15, 0.15, 1, 8]} />
          <meshBasicMaterial color="#f44" transparent opacity={0.6} blending={THREE.AdditiveBlending} depthWrite={false} />
        </mesh>
      </group>
    </>
  )
}
