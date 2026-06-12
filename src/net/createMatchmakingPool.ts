import { MatchmakingPool } from './matchmaking'
import type { IDiscovery } from './discovery/IDiscovery'
import { LoopbackDiscovery } from './discovery/LoopbackDiscovery'
import { BroadcastChannelDiscovery } from './discovery/BroadcastChannelDiscovery'
import { NostrDiscovery } from './discovery/NostrDiscovery'
import { resolveNetKind } from './createNet'

/**
 * IDiscovery по выбранному транспорту: `bc` → BroadcastChannel (same-origin вкладки + e2e);
 * иначе → Nostr (интернет-масштаб: pub/sub эфемерных событий по релеям, без mesh).
 */
export function createDiscovery(): IDiscovery {
  return resolveNetKind() === 'bc' ? new BroadcastChannelDiscovery() : new NostrDiscovery()
}

export function createMatchmakingPool(): MatchmakingPool {
  return new MatchmakingPool(createDiscovery())
}

export { LoopbackDiscovery }
