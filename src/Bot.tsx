import { RefObject, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useFrame, useThree } from '@react-three/fiber'
import { randomArenaPos } from './Arena'
import { Beam3D } from './components/Beam3D'
import { performRaycast } from './utils/raycast'
import {
  TARGET_SPEED, BOT_FIRE_INTERVAL, BOT_WINDUP, BEAM_DURATION,
  BOT_SHIELD_INTERVAL, BOT_SHIELD_DURATION,
  BOT_COLOR_BASE, BOT_COLOR_WHITE,
} from './constants'
import type { BotDifficulty } from './constants'

interface BotProps {
  botId: number
  targetRef: RefObject<THREE.Mesh | null>
  botRespawnRef: RefObject<(() => void) | null>
  playerPosRef: RefObject<THREE.Vector3>
  isShieldActive: () => boolean
  onPlayerHit: () => void
  onShieldBlock: () => void
  onBotShieldChange: (active: boolean) => void
  difficulty?: BotDifficulty
}

const BASE_COLOR  = new THREE.Color(BOT_COLOR_BASE)
const WHITE_COLOR = new THREE.Color(BOT_COLOR_WHITE)

export function Bot({
  botId, targetRef, botRespawnRef, playerPosRef, isShieldActive,
  onPlayerHit, onShieldBlock, onBotShieldChange, difficulty = 'normal',
}: BotProps) {
  const isPassive = difficulty === 'passive'
  const { scene } = useThree()

  const groupRef    = useRef<THREE.Group>(null!)
  const bodyMeshRef = useRef<THREE.Mesh>(null!)
  const bodyMatRef  = useRef<THREE.MeshStandardMaterial>(null!)
  const waypointRef = useRef<THREE.Vector3>(randomArenaPos())
  const initPos     = useRef(randomArenaPos())

  const shootTimer  = useRef(0)
  const isWindingUp = useRef(false)
  const windupTimer = useRef(0)
  const isShrinking = useRef(false)
  const shrinkTimer = useRef(0)

  const botShieldGroupRef = useRef<THREE.Group>(null!)
  const botShieldMatRef   = useRef<THREE.MeshBasicMaterial>(null!)
  const botShieldWireRef  = useRef<THREE.MeshBasicMaterial>(null!)
  const botShieldTimer    = useRef(0)
  const botShieldActive   = useRef(false)
  const botShieldDuration = useRef(0)

  // Beam visual refs (passed to Beam3D)
  const beamActiveRef   = useRef(false)
  const beamEndRef      = useRef<THREE.Vector3 | null>(null)
  const beamFireTimeRef = useRef(0)
  const beamStartRef    = useRef(new THREE.Vector3())

  useEffect(() => {
    botRespawnRef.current = () => {
      if (!groupRef.current || !bodyMatRef.current) return
      isWindingUp.current = false
      isShrinking.current = false
      windupTimer.current = 0
      shrinkTimer.current = 0
      shootTimer.current  = 0
      if (bodyMeshRef.current) bodyMeshRef.current.scale.setScalar(1)
      botShieldActive.current = false
      botShieldTimer.current  = 0
      botShieldDuration.current = 0
      if (botShieldGroupRef.current) botShieldGroupRef.current.visible = false
      onBotShieldChange(false)
      bodyMatRef.current.color.set('red')
      setTimeout(() => {
        if (!bodyMatRef.current || !groupRef.current) return
        bodyMatRef.current.color.copy(BASE_COLOR)
        groupRef.current.position.copy(randomArenaPos())
        waypointRef.current = randomArenaPos()
      }, 150)
    }
    return () => { botRespawnRef.current = null }
  }, [botRespawnRef, onBotShieldChange])

  useEffect(() => {
    const w = window as any
    if (!w.__debugBotPos) w.__debugBotPos = {}
    w.__debugBotPos[botId] = () => {
      const p = groupRef.current?.position
      return p ? { x: p.x, y: p.y, z: p.z } : null
    }
    return () => { delete w.__debugBotPos?.[botId] }
  }, [botId])

  useFrame((_, delta) => {
    if (!groupRef.current) return
    const pos = groupRef.current.position

    // Movement
    if (!isPassive && !isWindingUp.current) {
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

    if (targetRef.current) targetRef.current.position.copy(pos)

    // Bot shield timer
    if (!isPassive) {
      if (!botShieldActive.current) {
        botShieldTimer.current += delta * 1000
        if (botShieldTimer.current >= BOT_SHIELD_INTERVAL) {
          botShieldTimer.current = 0
          botShieldActive.current = true
          botShieldDuration.current = 0
          if (botShieldGroupRef.current) botShieldGroupRef.current.visible = true
          onBotShieldChange(true)
        }
      } else {
        botShieldDuration.current += delta * 1000
        if (botShieldDuration.current >= BOT_SHIELD_DURATION) {
          botShieldActive.current = false
          botShieldDuration.current = 0
          if (botShieldGroupRef.current) botShieldGroupRef.current.visible = false
          onBotShieldChange(false)
        } else {
          const pulse = 0.5 + 0.5 * Math.sin(Date.now() * 0.007)
          if (botShieldMatRef.current) botShieldMatRef.current.opacity = 0.08 + 0.1 * pulse
          if (botShieldWireRef.current) botShieldWireRef.current.opacity = 0.3 + 0.3 * pulse
        }
      }
    }

    // Shoot + windup
    if (!isPassive) {
      if (!isWindingUp.current && !isShrinking.current) {
        shootTimer.current += delta * 1000
        if (shootTimer.current >= BOT_FIRE_INTERVAL) {
          shootTimer.current = 0
          isWindingUp.current = true
          windupTimer.current = 0
        }
      } else if (isWindingUp.current) {
        windupTimer.current += delta * 1000
        const windupP = Math.min(windupTimer.current / BOT_WINDUP, 1)

        if (bodyMatRef.current) bodyMatRef.current.color.lerpColors(BASE_COLOR, WHITE_COLOR, windupP)
        if (bodyMeshRef.current) bodyMeshRef.current.scale.setScalar(1 + windupP * 0.4)

        if (windupP >= 1) {
          isWindingUp.current = false
          windupTimer.current = 0
          isShrinking.current = true
          shrinkTimer.current = 0
          if (bodyMatRef.current) bodyMatRef.current.color.copy(BASE_COLOR)

          const botChest  = pos.clone().add(new THREE.Vector3(0, 0.5, 0))
          const playerPos = playerPosRef.current.clone()
          const dir = playerPos.clone().sub(botChest).normalize()

          const hits = performRaycast(scene, botChest, dir, {
            excludeNames:      ['target'],
            excludeUserDataKeys: ['noRaycast', 'botBeam'],
          })
          const distToPlayer = botChest.distanceTo(playerPos)
          const blocked = hits.length > 0 && hits[0].distance < distToPlayer

          beamStartRef.current.copy(botChest)
          beamEndRef.current = blocked ? hits[0].point.clone() : playerPos.clone()
          beamActiveRef.current = true
          beamFireTimeRef.current = Date.now()

          if (!blocked) {
            if (isShieldActive()) onShieldBlock()
            else setTimeout(onPlayerHit, BEAM_DURATION)
          }
        }
      } else if (isShrinking.current) {
        shrinkTimer.current += delta * 1000
        const shrinkP = Math.min(shrinkTimer.current / (BOT_WINDUP / 3), 1)
        if (bodyMeshRef.current) bodyMeshRef.current.scale.setScalar(1 + 0.4 * (1 - shrinkP))
        if (shrinkP >= 1) {
          isShrinking.current = false
          shrinkTimer.current = 0
          if (bodyMeshRef.current) bodyMeshRef.current.scale.setScalar(1)
        }
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
        userData={{ botId }}
        visible={false}
      >
        <boxGeometry args={[1, 2, 1]} />
        <meshStandardMaterial />
      </mesh>

      {/* Bot model */}
      <group ref={groupRef} position={initPos.current.toArray() as [number, number, number]}>
        <mesh ref={bodyMeshRef} position={[0, 0.5, 0]} castShadow userData={{ noRaycast: true }}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshStandardMaterial ref={bodyMatRef} color={BOT_COLOR_BASE} />
        </mesh>
        <group ref={botShieldGroupRef} position={[0, 0.5, 0]} visible={false}>
          <mesh userData={{ noRaycast: true }}>
            <sphereGeometry args={[0.75, 16, 16]} />
            <meshBasicMaterial ref={botShieldMatRef} color="#4af" transparent opacity={0.1} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          <mesh userData={{ noRaycast: true }}>
            <sphereGeometry args={[0.76, 12, 8]} />
            <meshBasicMaterial ref={botShieldWireRef} color="#4af" wireframe transparent opacity={0.4} depthWrite={false} />
          </mesh>
        </group>
      </group>

      {/* Bot beam */}
      <Beam3D
        getStart={() => beamStartRef.current.clone()}
        endRef={beamEndRef}
        activeRef={beamActiveRef}
        fireTimeRef={beamFireTimeRef}
        duration={BEAM_DURATION}
        innerColor="white"
        outerColor="#f44"
        outerOpacity={0.6}
        groupUserData={{ botBeam: true }}
      />
    </>
  )
}
