import type { IDiscovery } from './IDiscovery'
import type { PoolListing } from '../matchmaking'

/** In-process pub/sub для юнит-тестов: один инстанс — общая среда host↔client. */
export class LoopbackDiscovery implements IDiscovery {
  private listings = new Map<string, Map<string, PoolListing>>()      // bucket → code → listing
  private subs = new Map<string, Set<(l: PoolListing) => void>>()     // bucket → подписчики

  publish(bucket: string, listing: PoolListing) {
    let m = this.listings.get(bucket)
    if (!m) { m = new Map(); this.listings.set(bucket, m) }
    m.set(listing.code, listing)
    this.subs.get(bucket)?.forEach(cb => cb(listing))
  }

  withdraw(bucket: string, code: string) { this.listings.get(bucket)?.delete(code) }

  subscribe(bucket: string, onListing: (l: PoolListing) => void): () => void {
    let set = this.subs.get(bucket)
    if (!set) { set = new Set(); this.subs.set(bucket, set) }
    set.add(onListing)
    this.listings.get(bucket)?.forEach(l => onListing(l))   // снапшот текущих
    return () => { this.subs.get(bucket)?.delete(onListing) }
  }

  dispose() { this.listings.clear(); this.subs.clear() }
}
