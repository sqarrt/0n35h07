import type { IDiscovery } from './IDiscovery'
import type { PoolListing } from '../matchmaking'

interface Wire {
  kind: 'list' | 'unlist' | 'whois'
  bucket: string
  listing?: PoolListing
  code?: string
}

/**
 * Discovery поверх BroadcastChannel (same-origin вкладки + e2e). Снапшот для позднего подписчика —
 * через 'whois': при subscribe шлём запрос по корзине, публикующие хосты ретранслируют свой листинг.
 */
export class BroadcastChannelDiscovery implements IDiscovery {
  private ch = new BroadcastChannel('oneshot:discovery')
  private listings = new Map<string, Map<string, PoolListing>>()   // bucket → code → listing
  private subs = new Map<string, Set<(l: PoolListing) => void>>()
  private mine = new Map<string, PoolListing>()                    // bucket → свой листинг (ответ на whois)

  constructor() { this.ch.onmessage = (e: MessageEvent<Wire>) => this.receive(e.data) }

  publish(bucket: string, listing: PoolListing) {
    this.mine.set(bucket, listing)
    this.store(bucket, listing)
    this.ch.postMessage({ kind: 'list', bucket, listing } satisfies Wire)
  }

  withdraw(bucket: string, code: string) {
    this.mine.delete(bucket)
    this.listings.get(bucket)?.delete(code)
    this.ch.postMessage({ kind: 'unlist', bucket, code } satisfies Wire)
  }

  subscribe(bucket: string, onListing: (l: PoolListing) => void): () => void {
    let set = this.subs.get(bucket)
    if (!set) { set = new Set(); this.subs.set(bucket, set) }
    set.add(onListing)
    this.listings.get(bucket)?.forEach(l => onListing(l))                 // локальный снапшот
    this.ch.postMessage({ kind: 'whois', bucket } satisfies Wire)          // снапшот от других вкладок
    return () => { this.subs.get(bucket)?.delete(onListing) }
  }

  dispose() { this.ch.close(); this.listings.clear(); this.subs.clear(); this.mine.clear() }

  private store(bucket: string, listing: PoolListing) {
    let m = this.listings.get(bucket)
    if (!m) { m = new Map(); this.listings.set(bucket, m) }
    m.set(listing.code, listing)
    this.subs.get(bucket)?.forEach(cb => cb(listing))
  }

  private receive(w: Wire) {
    if (w.kind === 'list' && w.listing) this.store(w.bucket, w.listing)
    else if (w.kind === 'unlist' && w.code) this.listings.get(w.bucket)?.delete(w.code)
    else if (w.kind === 'whois') {
      const mine = this.mine.get(w.bucket)
      if (mine) this.ch.postMessage({ kind: 'list', bucket: w.bucket, listing: mine } satisfies Wire)
    }
  }
}
