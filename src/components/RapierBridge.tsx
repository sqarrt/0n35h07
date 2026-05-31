import { useEffect } from 'react'
import { useRapier } from '@react-three/rapier'
import type { Match } from '../game/Match'

/** Отдаёт Match физический мир Rapier (для KinematicCharacterController). Ничего не рендерит. */
export function RapierBridge({ match }: { match: Match }) {
  const { world, rapier } = useRapier()
  useEffect(() => {
    match.attachWorld(world, rapier)
    return () => match.detachWorld()
  }, [world, rapier, match])
  return null
}
