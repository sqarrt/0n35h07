import { useRef, useEffect, useCallback } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  TARGET_SPEED, BOT_FIRE_INTERVAL, BOT_WINDUP, BOT_SHIELD_INTERVAL,
} from '../constants'
import { randomArenaPos } from '../Arena'

interface BotControllerConfig {
  botId:               number
  bodyPosRef:          React.RefObject<THREE.Vector3>
  playerPosRef:        React.RefObject<THREE.Vector3>
  onFire:              (setBeamEnd: (v: THREE.Vector3) => void) => void
  shieldForceActivate: () => void
  isPassive:           boolean
}

interface BotControllerResult {
  windupProgressRef: React.RefObject<number>
  beamActiveRef:     React.RefObject<boolean>
  beamEndRef:        React.RefObject<THREE.Vector3 | null>
  beamFireTimeRef:   React.RefObject<number>
  reset:             () => void
  reposition:        () => void
}

export function useBotController({
  botId, bodyPosRef, playerPosRef, onFire, shieldForceActivate, isPassive,
}: BotControllerConfig): BotControllerResult {
  const waypointRef       = useRef<THREE.Vector3>(randomArenaPos())
  const shootTimer        = useRef(0)
  const isWindingUp       = useRef(false)
  const windupTimer       = useRef(0)
  const windupProgressRef = useRef(0)
  const beamActiveRef     = useRef(false)
  const beamEndRef        = useRef<THREE.Vector3 | null>(null)
  const beamFireTimeRef   = useRef(0)
  const botShieldTimer    = useRef(0)

  useEffect(() => {
    const w = window as any
    if (!w.__debugBotPos) w.__debugBotPos = {}
    w.__debugBotPos[botId] = () => {
      const p = bodyPosRef.current
      return p ? { x: p.x, y: p.y, z: p.z } : null
    }
    return () => { delete w.__debugBotPos?.[botId] }
  }, [botId, bodyPosRef])

  useFrame((_, delta) => {
    const pos = bodyPosRef.current

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

    if (!isPassive) {
      botShieldTimer.current += delta * 1000
      if (botShieldTimer.current >= BOT_SHIELD_INTERVAL) {
        botShieldTimer.current = 0
        shieldForceActivate()
      }
    }

    if (!isPassive) {
      if (!isWindingUp.current) {
        shootTimer.current += delta * 1000
        if (shootTimer.current >= BOT_FIRE_INTERVAL) {
          shootTimer.current = 0
          isWindingUp.current = true
          windupTimer.current = 0
          windupProgressRef.current = 0
        }
      } else {
        windupTimer.current += delta * 1000
        windupProgressRef.current = Math.min(windupTimer.current / BOT_WINDUP, 1)

        if (windupProgressRef.current >= 1) {
          isWindingUp.current = false
          windupTimer.current = 0
          windupProgressRef.current = 0

          onFire((v: THREE.Vector3) => { beamEndRef.current = v })
          beamActiveRef.current = true
          beamFireTimeRef.current = Date.now()
        }
      }
    }
  })

  const reset = useCallback(() => {
    isWindingUp.current       = false
    windupTimer.current       = 0
    windupProgressRef.current = 0
    shootTimer.current        = 0
    beamActiveRef.current     = false
    beamFireTimeRef.current   = 0
    beamEndRef.current        = null
    botShieldTimer.current    = 0
  }, [])

  const reposition = useCallback(() => {
    waypointRef.current = randomArenaPos()
    bodyPosRef.current.copy(randomArenaPos())
  }, [bodyPosRef])

  return { windupProgressRef, beamActiveRef, beamEndRef, beamFireTimeRef, reset, reposition }
}
