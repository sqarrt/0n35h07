import type { RespawnStyle } from '../../../constants'
import type { IRespawnFx } from './types'
import { EchoRespawnFx } from './EchoRespawnFx'
import { ChaosRespawnFx } from './ChaosRespawnFx'
import { SwarmRespawnFx } from './SwarmRespawnFx'

/** Factory for the respawn strategy by style (boundary for Match and the menu preview). */
export function createRespawnFx(style: RespawnStyle, playerColor: string): IRespawnFx {
  switch (style) {
    case 'chaos': return new ChaosRespawnFx(playerColor)
    case 'swarm': return new SwarmRespawnFx(playerColor)
    case 'echo':  return new EchoRespawnFx(playerColor)
  }
}
