import type { MapId, MapFilter, DurationFilter } from '../constants'
import type { IDiscovery } from './discovery/IDiscovery'
import { gameLog } from '../diag/gameLog'

export type { MapFilter, DurationFilter }   // re-export (compatibility)

/** Host's pool advertisement: its room code + sets of acceptable maps/durations (≥1 in each). */
export interface PoolListing {
  code: string
  name: string
  color: string
  map: MapFilter            // host's map set (on connect a random one from the intersection with the client is picked)
  durationMin: DurationFilter
  dual: boolean             // the listing owner is also searching (both mode) — for the tie-breaker
}

/** What the client will accept: sets of maps/durations (a match exists if it intersects the host's set). */
export interface PoolFilter {
  map: MapFilter
  durationMin: DurationFilter
}

/** Set intersection (order follows the first). */
function intersect<T>(a: readonly T[], b: readonly T[]): T[] {
  return a.filter(x => b.includes(x))
}

/** A listing matches a filter if both maps and durations intersect (there's a mutually acceptable option). */
export function listingMatches(filter: PoolFilter, listing: PoolListing): boolean {
  return intersect(filter.map, listing.map).length > 0 && intersect(filter.durationMin, listing.durationMin).length > 0
}

/** Final match params (host-authoritative): random picks from the intersection of host and client sets. */
export function resolveMatchParams(
  host: PoolFilter,
  client: PoolFilter,
  pickMap: (opts: MapId[]) => MapId,
  pickDuration: (opts: number[]) => number,
): { mapId: MapId; durationMin: number } {
  // Empty intersection (client arrived with an incompatible set) → take the host's pick: it's the authority, and this
  // guards against undefined → default map / durationMs=NaN. Normally the intersection is non-empty (see listingMatches).
  const maps = intersect(host.map, client.map)
  const durs = intersect(host.durationMin, client.durationMin)
  // The smoking gun for "I picked X, got Y": no overlap → the client's choice is silently dropped for the host's.
  if (!maps.length) gameLog.warn('nego', 'map_no_overlap', { host: host.map, client: client.map, using: host.map })
  if (!durs.length) gameLog.warn('nego', 'duration_no_overlap', { host: host.durationMin, client: client.durationMin, using: host.durationMin })
  return {
    mapId: pickMap(maps.length ? maps : host.map),
    durationMin: pickDuration(durs.length ? durs : host.durationMin),
  }
}

/** Discovery bucket key for a specific map+duration within a namespace (version+platform). */
export function bucketKey(map: MapId, durationMin: number, namespace: string): string {
  return `mm:${namespace}:${map}:${durationMin}`
}

/** Buckets the HOST publishes the listing into: cross-product of chosen maps × durations (within the namespace). */
export function bucketsForListing(map: MapFilter, durationMin: DurationFilter, namespace: string): string[] {
  return map.flatMap(m => durationMin.map(d => bucketKey(m, d, namespace)))
}

/** Buckets the CLIENT subscribes to: same rules as the listing. */
export function bucketsForFilter(map: MapFilter, durationMin: DurationFilter, namespace: string): string[] {
  return bucketsForListing(map, durationMin, namespace)
}

/**
 * Matchmaking layer over IDiscovery (pub/sub per bucket, no mesh). The host fans the listing out to all
 * compatible buckets; the client subscribes to its filter's buckets and takes the first compatible listing.
 * The real match runs through a normal RoomSession by that code — the pool is discovery only.
 */
export class MatchmakingPool {
  private disco: IDiscovery
  private namespace: string                  // version+platform: pools of different versions/platforms don't overlap
  private listing: PoolListing | null = null
  private listingBuckets: string[] = []
  private unsubs: Array<() => void> = []
  private filter: PoolFilter | null = null
  private matchHandler: ((listing: PoolListing) => boolean) | null = null
  private rejected = new Set<string>()

  constructor(disco: IDiscovery, namespace: string) { this.disco = disco; this.namespace = namespace }

  /** HOST: publish the listing into all compatible buckets (fan-out across the "any" axes). */
  advertise(listing: PoolListing) {
    this.withdraw()
    this.listing = listing
    this.listingBuckets = bucketsForListing(listing.map, listing.durationMin, this.namespace)
    for (const b of this.listingBuckets) this.disco.publish(b, listing)
  }

  /** HOST: withdraw the listing from all buckets (slot taken / search stopped / leaving). */
  withdraw() {
    if (this.listing) for (const b of this.listingBuckets) this.disco.withdraw(b, this.listing.code)
    this.listing = null
    this.listingBuckets = []
  }

  /** CLIENT: subscribe to the filter's buckets; onMatch(listing)→true consumes (search stops), →false — keep listening. */
  search(filter: PoolFilter, onMatch: (listing: PoolListing) => boolean) {
    this.cancel()
    this.filter = filter
    this.matchHandler = onMatch
    for (const b of bucketsForFilter(filter.map, filter.durationMin, this.namespace)) {
      this.unsubs.push(this.disco.subscribe(b, l => this.onListing(l)))
    }
  }

  /** CLIENT: the code didn't work (host busy/gone) — skip it in further searches. */
  reject(code: string) { this.rejected.add(code) }

  /** CLIENT: stop searching (unsubscribe from all buckets). */
  cancel() {
    for (const off of this.unsubs) off()
    this.unsubs = []
    this.filter = null
    this.matchHandler = null
  }

  private onListing(listing: PoolListing) {
    if (!this.filter || !this.matchHandler) return
    if (this.rejected.has(listing.code)) return
    if (!listingMatches(this.filter, listing)) return   // safety net (buckets already filtered)
    if (this.matchHandler(listing)) this.cancel()       // consume → unsubscribe; otherwise keep listening
  }

  dispose() { this.withdraw(); this.cancel() }
}
