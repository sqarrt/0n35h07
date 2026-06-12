import { MatchmakingPool } from './matchmaking'
import { createNet } from './createNet'
import { MM_POOL_ROOM } from '../constants'

/**
 * Пул на реальном транспорте (Trystero/BroadcastChannel — по resolveNetKind), комната-пул.
 * Вынесено из matchmaking.ts, чтобы тот оставался browser-free для юнит-тестов
 * (createNet тянет TrysteroNet/BroadcastChannel — браузерные API).
 */
export function createMatchmakingPool(): MatchmakingPool {
  return new MatchmakingPool(createNet(MM_POOL_ROOM))
}
