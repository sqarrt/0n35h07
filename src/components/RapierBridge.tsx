import { useEffect } from 'react'
import { useRapier } from '@react-three/rapier'
import type { Match } from '../game/Match'

/** Hands Match the Rapier physics world (for KinematicCharacterController). Renders nothing. */
export function RapierBridge({ match }: { match: Match }) {
  const { world, rapier } = useRapier()
  useEffect(() => {
    match.attachWorld(world, rapier)
    return () => match.detachWorld()
  }, [world, rapier, match])
  return null
}
