import type { PoolListing } from '../matchmaking'

/**
 * Pub/sub discovery by buckets (no WebRTC mesh). The host publishes a listing into a bucket
 * (with heartbeat/TTL at the implementation level), the client subscribes to the bucket. WebRTC is
 * established separately — a single link between the matched opponents (the host's private room by code).
 */
export interface IDiscovery {
  publish(bucket: string, listing: PoolListing): void
  withdraw(bucket: string, code: string): void
  /** Subscribe: onListing is called for every current (snapshot) and new listing in the bucket. Returns unsubscribe. */
  subscribe(bucket: string, onListing: (listing: PoolListing) => void): () => void
  dispose(): void
}
