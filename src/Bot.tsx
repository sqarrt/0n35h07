import { RefObject, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { useThree } from '@react-three/fiber'
import { randomArenaPos } from './Arena'
import { PlayerEntity } from './components/PlayerEntity'
import { useShieldSystem } from './hooks/useShieldSystem'
import { useBotController } from './hooks/useBotController'
import { performRaycast } from './utils/raycast'
import { BEAM_DURATION, BOT_SHIELD_DURATION, BOT_SHIELD_INTERVAL } from './constants'
import type { BotDifficulty } from './constants'
import type { Particle } from './types'

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

export function Bot({
  botId, targetRef, botRespawnRef, playerPosRef, isShieldActive,
  onPlayerHit, onShieldBlock, onBotShieldChange, difficulty = 'normal',
}: BotProps) {
  const { scene }     = useThree()
  const bodyPosRef    = useRef(randomArenaPos())
  const deathFlashRef = useRef<(() => void) | null>(null)
  const particlesRef  = useRef<Particle[]>([])

  const shield = useShieldSystem({
    duration:     BOT_SHIELD_DURATION,
    cooldown:     BOT_SHIELD_INTERVAL - BOT_SHIELD_DURATION,
    onActivate:   () => onBotShieldChange(true),
    onDeactivate: () => onBotShieldChange(false),
  })

  const onFire = (setBeamEnd: (v: THREE.Vector3) => void) => {
    const botChest  = bodyPosRef.current.clone().add(new THREE.Vector3(0, 0.5, 0))
    const playerPos = playerPosRef.current.clone()
    const dir = playerPos.clone().sub(botChest).normalize()
    const hits = performRaycast(scene, botChest, dir, {
      excludeNames:        ['target'],
      excludeUserDataKeys: ['noRaycast', 'botBeam'],
    })
    const distToPlayer = botChest.distanceTo(playerPos)
    const blocked = hits.length > 0 && hits[0].distance < distToPlayer
    setBeamEnd(blocked ? hits[0].point.clone() : playerPos.clone())
    if (!blocked) {
      if (isShieldActive()) onShieldBlock()
      else setTimeout(onPlayerHit, BEAM_DURATION)
    }
  }

  const { windupProgressRef, beamActiveRef, beamEndRef, beamFireTimeRef, reset, reposition } =
    useBotController({
      botId,
      bodyPosRef,
      playerPosRef,
      onFire,
      shieldForceActivate: shield.forceActivate,
      isPassive: difficulty === 'passive',
    })

  const shieldResetRef = useRef(shield.reset)
  shieldResetRef.current = shield.reset

  useEffect(() => {
    botRespawnRef.current = () => {
      deathFlashRef.current?.()
      reset()
      shieldResetRef.current()
      setTimeout(reposition, 150)
    }
    return () => { botRespawnRef.current = null }
  }, [botRespawnRef, reset, reposition])

  const getBeamStart = () =>
    bodyPosRef.current.clone().add(new THREE.Vector3(0, 0.5, 0))

  return (
    <PlayerEntity
      bodyPosRef={bodyPosRef}
      getWindupProgress={() => windupProgressRef.current}
      shieldIsActive={shield.isActive}
      beam={{
        activeRef:    beamActiveRef,
        endRef:       beamEndRef,
        fireTimeRef:  beamFireTimeRef,
        getStart:     getBeamStart,
        particlesRef,
        duration:     BEAM_DURATION,
        innerColor:   'white',
        outerColor:   '#f44',
        groupUserData: { botBeam: true },
      }}
      hitbox={{
        targetRef: targetRef,
        name:      'target',
        userData:  { botId },
      }}
      deathFlashRef={deathFlashRef}
    />
  )
}
