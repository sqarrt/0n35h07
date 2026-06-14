import { SimplePool } from 'nostr-tools/pool'
import { finalizeEvent, generateSecretKey, getPublicKey } from 'nostr-tools/pure'
import type { Event, EventTemplate } from 'nostr-tools/pure'
import type { IDiscovery } from './IDiscovery'
import type { PoolListing } from '../matchmaking'
import { resolveRelaysSync } from '../relays'
import { netDiagMark } from '../netDiag'

// Эфемерные события (kind 20000–29999, NIP-01): релей рассылает подписчикам, но НЕ хранит — идеально
// для presence/листингов. Корзина едет тегом ['d', bucket], подписчик фильтрует по '#d'.
const EPHEMERAL_KIND = 20100
const HEARTBEAT_MS = 3000        // переобъявление листинга (релей не хранит → поздний подписчик ждёт ≤ этого)
// Запас для `since`: релей форвардит событие, только если created_at >= since. since считается по ЛОКАЛЬНЫМ
// часам, created_at — по часам отправителя; у разных машин часы расходятся. Без запаса опережающие часы
// подписчика отсекают живые heartbeat'ы хоста → пиры не находят друг друга при односторонней discovery
// (явные роли). 5 мин с лихвой покрывают типичный clock skew. Эфемерные события не хранятся — лишнего не придёт.
const SUBSCRIBE_SKEW_S = 300
const FALLBACK_RELAYS = ['wss://relay.damus.io', 'wss://nos.lol', 'wss://relay.nostr.band']

interface Payload { t: 'list' | 'unlist'; listing?: PoolListing; code?: string }

interface Sub { closer: { close(): void }; cache: Map<string, PoolListing>; cbs: Set<(l: PoolListing) => void> }

/**
 * Discovery через Nostr-релеи (интернет-масштаб): эфемерные подписанные события по корзинам, без
 * WebRTC-mesh. Хост публикует/heartbeat'ит листинг; клиент подписывается на корзину и читает поток.
 * Распределение по нескольким релеям (resolveRelaysSync) — нагрузка размазывается.
 */
export class NostrDiscovery implements IDiscovery {
  private pool = new SimplePool({ enableReconnect: true })
  private relays: string[]
  private sk = generateSecretKey()
  private pk = getPublicKey(this.sk)
  private mine = new Map<string, PoolListing>()   // bucket → свой листинг (для heartbeat)
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
    entry.cache.forEach(l => onListing(l))   // снапшот уже виденных в этой подписке
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
    for (const p of this.pool.publish(this.relays, evt)) p.catch(() => { /* релей мог отклонить — не критично */ })
  }

  private onEvent(bucket: string, e: Event) {
    if (e.pubkey === this.pk) return                 // свои же события игнорим
    let payload: Payload
    try { payload = JSON.parse(e.content) as Payload } catch { return }
    const entry = this.subs.get(bucket)
    if (!entry) return
    if (payload.t === 'list' && payload.listing) {
      const l = payload.listing
      if (!entry.cache.has(l.code)) netDiagMark('disco:recv', { bucket, code: l.code })   // первый приём листинга (без флуда heartbeat'ами)
      entry.cache.set(l.code, l)
      entry.cbs.forEach(cb => cb(l))
    } else if (payload.t === 'unlist' && payload.code) {
      entry.cache.delete(payload.code)
    }
  }
}
