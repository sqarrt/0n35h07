import { useRef, useState, useCallback } from 'react'
import * as THREE from 'three'
import { useFrame } from '@react-three/fiber'
import {
  BEAM_COOLDOWN, BEAM_WINDUP, BEAM_DURATION, WINDUP_LOOK_FACTOR, GRAVITY,
} from '../constants'
import { performRaycast } from '../utils/raycast'
import type { HUDAction } from './useGameHUD'

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

interface BeamWeaponConfig {
  controlsRef: React.RefObject<any>
  getBotShieldActive: (botId: number) => boolean
  getBotRespawn: (botId: number) => (() => void) | null
  onBotShieldHit: () => void
  onFire: () => void
  dispatch: (action: HUDAction) => void
  playerBodyPos?: React.RefObject<THREE.Vector3>
}

function chestStart(cam: THREE.Camera, bodyPos?: THREE.Vector3): THREE.Vector3 {
  const origin = bodyPos ?? cam.position
  const dir = new THREE.Vector3()
  cam.getWorldDirection(dir)
  dir.y = 0
  dir.normalize()
  const right = new THREE.Vector3().crossVectors(dir, new THREE.Vector3(0, 1, 0)).normalize()
  return origin.clone()
    .add(new THREE.Vector3(0, -0.85, 0))
    .addScaledVector(right, 0.8)
    .addScaledVector(dir, 0.1)
}

export function useBeamWeapon(
  camera: THREE.Camera,
  scene: THREE.Scene,
  config: BeamWeaponConfig
) {
  const beamWindup       = useRef(false)
  const beamCooldown     = useRef(false)
  const beamCooldownEnd  = useRef(0)
  const windupStartTime  = useRef(0)
  const prevWindupActive = useRef(false)

  const beamActiveRef   = useRef(false)
  const beamEndRef      = useRef<THREE.Vector3 | null>(null)
  const beamFireTimeRef = useRef(0)

  const windupTimerId   = useRef<ReturnType<typeof setTimeout> | null>(null)
  const cooldownTimerId = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [afterglow, setAfterglow] = useState<Afterglow | null>(null)
  const particlesRef = useRef<Particle[]>([])
  const [, forceParticleRender] = useState(0)

  // Always-current config in ref so timers see latest values
  const cfgRef = useRef(config)
  cfgRef.current = config

  // Always-current fire logic — updated every render so closures are fresh
  const doFireRef = useRef<() => void>(() => {})
  doFireRef.current = () => {
    windupTimerId.current = null
    beamWindup.current = false
    if (cfgRef.current.controlsRef.current) cfgRef.current.controlsRef.current.pointerSpeed = 1.0

    const dir = new THREE.Vector3()
    camera.getWorldDirection(dir)

    const origin = cfgRef.current.playerBodyPos?.current ?? camera.position
    const hits = performRaycast(scene, origin.clone(), dir)

    let end: THREE.Vector3
    if (hits.length > 0) {
      end = hits[0].point.clone()
      if (hits[0].object.name === 'target') {
        const botId = (hits[0].object.userData.botId ?? 0) as number
        if (cfgRef.current.getBotShieldActive(botId)) {
          cfgRef.current.onBotShieldHit()
        } else {
          const hp = end.clone()
          ;(window as any).__debugTargetHitCount = ((window as any).__debugTargetHitCount ?? 0) + 1
          particlesRef.current = Array.from({ length: 6 }, () => ({
            pos: hp.clone(),
            vel: new THREE.Vector3(
              (Math.random() - 0.5) * 8,
              Math.random() * 6,
              (Math.random() - 0.5) * 8,
            ),
            life: 1.0,
          }))
          cfgRef.current.getBotRespawn(botId)?.()
        }
      }
    } else {
      end = origin.clone().addScaledVector(dir, 100)
    }

    cfgRef.current.onFire()

    beamEndRef.current = end
    beamActiveRef.current = true
    beamFireTimeRef.current = Date.now()

    setAfterglow({ start: chestStart(camera, cfgRef.current.playerBodyPos?.current), end: end.clone(), opacity: 0.5 })

    beamCooldown.current = true
    beamCooldownEnd.current = Date.now() + BEAM_COOLDOWN
    cooldownTimerId.current = setTimeout(() => {
      cooldownTimerId.current = null
      beamCooldown.current = false
    }, BEAM_COOLDOWN)
  }

  const startWindup = useCallback(() => {
    if (beamCooldown.current || beamWindup.current) return
    if (!document.pointerLockElement) return

    beamWindup.current = true
    windupStartTime.current = Date.now()
    if (cfgRef.current.controlsRef.current) {
      cfgRef.current.controlsRef.current.pointerSpeed = WINDUP_LOOK_FACTOR
    }
    windupTimerId.current = setTimeout(() => doFireRef.current(), BEAM_WINDUP)
  }, [])

  const resetOnDeath = useCallback(() => {
    if (windupTimerId.current) {
      clearTimeout(windupTimerId.current)
      windupTimerId.current = null
      doFireRef.current()
    }
    if (cooldownTimerId.current) {
      clearTimeout(cooldownTimerId.current)
      cooldownTimerId.current = null
    }
    beamWindup.current = false
    beamCooldown.current = false
    prevWindupActive.current = false
    if (cfgRef.current.controlsRef.current) cfgRef.current.controlsRef.current.pointerSpeed = 1.0
  }, [])

  // Windup progress → HUD overlay (every frame)
  useFrame(() => {
    if (beamWindup.current) {
      const windupP = Math.min((Date.now() - windupStartTime.current) / BEAM_WINDUP, 1)
      cfgRef.current.dispatch({ type: 'SET_WINDUP_PROGRESS', value: windupP })
      prevWindupActive.current = true
    } else if (prevWindupActive.current) {
      cfgRef.current.dispatch({ type: 'SET_WINDUP_PROGRESS', value: 0 })
      prevWindupActive.current = false
    }
  })

  // Afterglow fade
  useFrame((_, delta) => {
    if (afterglow) {
      const next = afterglow.opacity - delta * 1.8
      if (next <= 0) setAfterglow(null)
      else setAfterglow(prev => prev ? { ...prev, opacity: next } : null)
    }
  })

  // Particle physics
  useFrame((_, delta) => {
    if (particlesRef.current.length === 0) return
    particlesRef.current = particlesRef.current
      .map(p => ({
        pos: p.pos.clone().addScaledVector(p.vel, delta),
        vel: new THREE.Vector3(p.vel.x, p.vel.y + GRAVITY * delta, p.vel.z),
        life: p.life - delta * 3,
      }))
      .filter(p => p.life > 0)
    forceParticleRender(n => n + 1)
  })

  const isWindingUp = () => beamWindup.current

  const getCooldownProgress = (now: number): number =>
    beamCooldown.current ? Math.max(0, 1 - (beamCooldownEnd.current - now) / BEAM_COOLDOWN) : 1

  const getBeamStart = () => chestStart(camera, cfgRef.current.playerBodyPos?.current)

  return {
    startWindup,
    resetOnDeath,
    beamActiveRef,
    beamEndRef,
    beamFireTimeRef,
    afterglow,
    particlesRef,
    getCooldownProgress,
    isWindingUp,
    getBeamStart,
  }
}
