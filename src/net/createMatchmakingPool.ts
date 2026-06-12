import { MatchmakingPool } from './matchmaking'
import type { IDiscovery } from './discovery/IDiscovery'
import { LoopbackDiscovery } from './discovery/LoopbackDiscovery'
import { BroadcastChannelDiscovery } from './discovery/BroadcastChannelDiscovery'

/**
 * IDiscovery по выбранному транспорту.
 * TODO(P1b-Task5): интернет-путь (resolveNetKind() !== 'bc') → NostrDiscovery (масштаб через релеи).
 * До подключения Nostr обе ветки используют BroadcastChannel (same-origin вкладки + e2e).
 */
export function createDiscovery(): IDiscovery {
  return new BroadcastChannelDiscovery()
}

export function createMatchmakingPool(): MatchmakingPool {
  return new MatchmakingPool(createDiscovery())
}

export { LoopbackDiscovery }
