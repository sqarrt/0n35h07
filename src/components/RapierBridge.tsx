import { useEffect } from 'react'
import { useRapier } from '@react-three/rapier'
import type { Match } from '../game/Match'

/** Hands Match the Rapier physics world (for KinematicCharacterController). Renders nothing. */
export function RapierBridge({ match }: { match: Match }) {
  const { world, rapier, step } = useRapier()
  useEffect(() => {
    match.attachWorld(world, rapier)
    match.setStep(step)   // hand the fixed-tick driver Rapier's manual step (Physics is paused — we step per tick)
    return () => match.detachWorld()
  }, [world, rapier, step, match])
  return null
}
