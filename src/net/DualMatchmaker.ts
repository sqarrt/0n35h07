import type { MatchmakingPool, PoolListing, PoolFilter } from './matchmaking'
import type { SearchRole } from '../settings'
import { netDiagMark } from './netDiag'

export type ResolvedRole = 'host' | 'client'

export interface DualMatchmakerOpts {
  pool: MatchmakingPool
  mode: SearchRole                     // 'both' (host/client by luck) | 'client' (search only)
  code: string                         // our host code (advertise + tie-breaker)
  listing: Omit<PoolListing, 'dual'>   // what we publish (the dual flag is set by the class itself)
  filter: PoolFilter                   // what we search for
}

/**
 * Matchmaking orchestrator for "both roles at once". In both mode it simultaneously advertises our
 * listing (dual:true) and searches for others; when two dual peers meet, exactly one becomes the client
 * (deterministically by code: the smaller code stays host). The committed latch (first-wins):
 * the first path to resolve — an incoming connection to our host session (hostConnected) OR our own join —
 * fixes the role, the second path becomes a no-op. RoomSessions are owned by App; this class only handles the pool.
 */
export class DualMatchmaker {
  private pool: MatchmakingPool
  private mode: SearchRole
  private code: string
  private listing: Omit<PoolListing, 'dual'>
  private filter: PoolFilter
  private committed: ResolvedRole | null = null
  private joinCb: (code: string) => void = () => {}

  constructor(opts: DualMatchmakerOpts) {
    this.pool = opts.pool
    this.mode = opts.mode
    this.code = opts.code
    this.listing = opts.listing
    this.filter = opts.filter
  }

  /** App: our search decided we join someone else's code as a client. */
  onJoin(cb: (code: string) => void) { this.joinCb = cb }

  /** Start matchmaking according to the mode. */
  start() {
    netDiagMark('mm:start', { mode: this.mode, code: this.code })
    if (this.mode === 'both') this.pool.advertise({ ...this.listing, dual: true })   // 'both' hosts and searches
    this.pool.search(this.filter, l => this.onCandidate(l))                          // both 'both' and 'client' search
  }

  /** App: an opponent connected to our host session → commit host, stop listing/search. */
  hostConnected() {
    if (this.committed) return
    this.committed = 'host'
    this.pool.withdraw()
    this.pool.cancel()
  }

  /** Full stop (STOP / exit / role change). */
  stop() { this.pool.withdraw(); this.pool.cancel() }

  get resolved(): ResolvedRole | null { return this.committed }

  /** @returns true — candidate consumed (search stops); false — deferred (keep searching, stay host). */
  private onCandidate(listing: PoolListing): boolean {
    netDiagMark('mm:candidate', { code: listing.code, dual: listing.dual })
    if (this.committed) return true
    if (listing.code === this.code) return false   // our own listing (bus echo) — ignore, keep listening
    // both + dual peer + our code is smaller → stay host, wait for them as the client.
    if (this.mode === 'both' && listing.dual && this.code < listing.code) {
      this.pool.reject(listing.code)
      return false
    }
    this.committed = 'client'
    netDiagMark('mm:join', { code: listing.code })
    this.pool.withdraw()
    this.joinCb(listing.code)
    return true
  }
}
