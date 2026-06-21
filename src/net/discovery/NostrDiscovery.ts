import { SimplePool } from 'nostr-tools/pool'
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import type { Event, EventTemplate } from 'nostr-tools/pure'
import type { IDiscovery } from './IDiscovery'
import type { PoolListing } from '../matchmaking'
import { resolveRelaysSync } from '../relays'
import { netDiagMark } from '../netDiag'

// Ephemeral events (kind 20000–29999, NIP-01): the relay broadcasts to subscribers but does NOT store them —
// ideal for presence/listings. The bucket rides in a ['d', bucket] tag; subscribers filter by '#d'.
const EPHEMERAL_KIND = 20100
const HEARTBEAT_MS = 3000        // re-announce the listing (relay doesn't store → a late subscriber waits ≤ this)
// Slack for `since`: the relay forwards an event only if created_at >= since. since is computed from the LOCAL
// clock, created_at from the sender's clock; different machines have drifting clocks. Without slack, a subscriber
// with a fast clock cuts off the host's live heartbeats → peers can't find each other under one-way discovery
// (explicit roles). 5 min generously covers typical clock skew. Ephemeral events aren't stored — no excess arrives.
const SUBSCRIBE_SKEW_S = 300
const FALLBACK_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

interface Payload { t: 'list' | 'unlist'; listing?: PoolListing; code?: string }

interface Sub { closer: { close(): void }; cache: Map<string, PoolListing>; cbs: Set<(l: PoolListing) => void> }

/**
 * Discovery over Nostr relays (internet-scale): ephemeral signed events per bucket, no WebRTC mesh.
 * The host publishes/heartbeats a listing; the client subscribes to a bucket and reads the stream.
 * Spreading across several relays (resolveRelaysSync) distributes the load.
 */
export class NostrDiscovery implements IDiscovery {
  private pool = new SimplePool({ enableReconnect: true })
  private relays: string[]
  private sk = generateSecretKey()
  private pk = getPublicKey(this.sk)
  private mine = new Map<string, PoolListing>()   // bucket → own listing (for heartbeat)
  private subs = new Map<string, Sub>()
  private timer: ReturnType<typeof setInterval> | null = null

  constructor(relays: string[] = resolveRelaysSync()) {
    this.relays = relays.length ? relays : FALLBACK_RELAYS
  }

  publish(bucket: string, listing: PoolListing) {
    netDiagMark('disco:publish', { bucket, code: listing.code })
    this.mine.set(bucket, listing)
    this.send(bucket, { t: 'list', listing })
    if (!this.timer) {
      this.timer = setInterval(() => {
        for (const [b, l] of this.mine) this.send(b, { t: 'list', listing: l })
      }, HEARTBEAT_MS)
    }
  }

  withdraw(bucket: string, code: string) {
    this.mine.delete(bucket)
    this.send(bucket, { t: 'unlist', code })
    if (this.mine.size === 0 && this.timer) { clearInterval(this.timer); this.timer = null }
  }

  subscribe(bucket: string, onListing: (l: PoolListing) => void): () => void {
    netDiagMark('disco:subscribe', { bucket })
    let entry = this.subs.get(bucket)
    if (!entry) {
      const cache = new Map<string, PoolListing>()
      const cbs = new Set<(l: PoolListing) => void>()
      const closer = this.pool.subscribe(
        this.relays,
        { kinds: [EPHEMERAL_KIND], '#d': [bucket], since: Math.floor(Date.now() / 1000) - SUBSCRIBE_SKEW_S },
        { onevent: (e: Event) => this.onEvent(bucket, e) },
      )
      entry = { closer, cache, cbs }
      this.subs.set(bucket, entry)
    }
    entry.cbs.add(onListing)
    entry.cache.forEach(l => onListing(l))   // snapshot of listings already seen on this subscription
    return () => {
      const en = this.subs.get(bucket)
      if (!en) return
      en.cbs.delete(onListing)
      if (en.cbs.size === 0) { en.closer.close(); this.subs.delete(bucket) }
    }
  }

  dispose() {
    if (this.timer) { clearInterval(this.timer); this.timer = null }
    for (const en of this.subs.values()) en.closer.close()
    this.subs.clear()
    this.mine.clear()
    this.pool.destroy()
  }

  private send(bucket: string, payload: Payload) {
    const tmpl: EventTemplate = {
      kind: EPHEMERAL_KIND,
      tags: [['d', bucket]],
      content: JSON.stringify(payload),
      created_at: Math.floor(Date.now() / 1000),
    }
    const evt = finalizeEvent(tmpl, this.sk)
    for (const p of this.pool.publish(this.relays, evt)) p.catch(() => { /* a relay may reject — not critical */ })
  }

  private onEvent(bucket: string, e: Event) {
    if (e.pubkey === this.pk) return                 // ignore our own events
    let payload: Payload
    try { payload = JSON.parse(e.content) as Payload } catch { return }
    const entry = this.subs.get(bucket)
    if (!entry) return
    if (payload.t === 'list' && payload.listing) {
      const l = payload.listing
      if (!entry.cache.has(l.code)) netDiagMark('disco:recv', { bucket, code: l.code })   // first receipt of a listing (no flood from heartbeats)
      entry.cache.set(l.code, l)
      entry.cbs.forEach(cb => cb(l))
    } else if (payload.t === 'unlist' && payload.code) {
      entry.cache.delete(payload.code)
    }
  }
}
