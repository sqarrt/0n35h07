import { MatchmakingPool } from './matchmaking'
import type { IDiscovery } from './discovery/IDiscovery'
import { LoopbackDiscovery } from './discovery/LoopbackDiscovery'
import { BroadcastChannelDiscovery } from './discovery/BroadcastChannelDiscovery'
import { NostrDiscovery } from './discovery/NostrDiscovery'
import { resolveNetKind } from './createNet'
import { POOL_NAMESPACE } from './poolNamespace'

/**
 * IDiscovery by the chosen transport: `bc` → BroadcastChannel (same-origin tabs + e2e);
 * otherwise → Nostr (internet-scale: pub/sub of ephemeral events over relays, no mesh).
 */
export function createDiscovery(): IDiscovery {
  return resolveNetKind() === 'bc' ? new BroadcastChannelDiscovery() : new NostrDiscovery()
}

export function createMatchmakingPool(): MatchmakingPool {
  return new MatchmakingPool(createDiscovery(), POOL_NAMESPACE)
}

export { LoopbackDiscovery }
