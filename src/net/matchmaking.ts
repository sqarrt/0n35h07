import type { MapId } from '../constants'
import { MM_LISTING_HEARTBEAT_MS, MATCH_DURATIONS_MIN } from '../constants'
import { MAP_IDS } from '../game/maps'
import type { INet } from './INet'

export type MapFilter = MapId | 'any'
export type DurationFilter = number | 'any'

/** Объявление хоста в пуле: код его комнаты + предлагаемые параметры (могут быть «any»). */
export interface PoolListing {
  code: string
  name: string
  color: string
  map: MapFilter
  durationMin: DurationFilter
}

/** Что хочет найти клиент (любая ось может быть «any»). */
export interface PoolFilter {
  map: MapFilter
  durationMin: DurationFilter
}

/** Ось совместима, если значения равны ИЛИ хотя бы одна сторона = «any». */
function axisCompatible<T>(a: T | 'any', b: T | 'any'): boolean {
  return a === 'any' || b === 'any' || a === b
}

/** Листинг подходит фильтру клиента, если совместимы и карта, и время. */
export function listingMatches(filter: PoolFilter, listing: PoolListing): boolean {
  return axisCompatible(filter.map, listing.map) && axisCompatible(filter.durationMin, listing.durationMin)
}

/** Резолв одной оси: конкретное бьёт «any»; обе «any» → значение от rng-функции. */
function resolveAxis<T>(host: T | 'any', client: T | 'any', randomConcrete: () => T): T {
  if (host !== 'any') return host as T
  if (client !== 'any') return client as T
  return randomConcrete()
}

/** Финальные параметры матча (host-authoritative): применяет хост при коннекте. */
export function resolveMatchParams(
  host: PoolFilter,
  client: PoolFilter,
  randomMap: () => MapId,
  randomDuration: () => number,
): { mapId: MapId; durationMin: number } {
  return {
    mapId: resolveAxis(host.map, client.map, randomMap),
    durationMin: resolveAxis(host.durationMin, client.durationMin, randomDuration),
  }
}

/** Ключ корзины discovery по конкретным карте+времени. */
export function bucketKey(map: MapId, durationMin: number): string {
  return `mm:${map}:${durationMin}`
}

const MAPS_ALL: MapId[] = MAP_IDS
const DURS_ALL: number[] = [...MATCH_DURATIONS_MIN]

/** Корзины, в которые ХОСТ публикует листинг: кросс не-«any» осей (concrete→1, any→все значения). */
export function bucketsForListing(map: MapFilter, durationMin: DurationFilter): string[] {
  const maps = map === 'any' ? MAPS_ALL : [map]
  const durs = durationMin === 'any' ? DURS_ALL : [durationMin]
  return maps.flatMap(m => durs.map(d => bucketKey(m, d)))
}

/** Корзины, на которые КЛИЕНТ подписывается: те же правила, что у листинга. */
export function bucketsForFilter(map: MapFilter, durationMin: DurationFilter): string[] {
  return bucketsForListing(map, durationMin)
}

/**
 * Слой подбора поверх INet (на комнате-пуле). Хост публикует листинг (heartbeat),
 * клиент слушает и при первом совместимом листинге зовёт onMatch(code).
 * Реальный матч идёт через обычный RoomSession по этому коду — пул только discovery.
 */
export class MatchmakingPool {
  private net: INet
  private heartbeatMs: number
  private timer: ReturnType<typeof setInterval> | null = null
  private listing: PoolListing | null = null
  private filter: PoolFilter | null = null
  private matchHandler: ((code: string) => void) | null = null
  private rejected = new Set<string>()

  constructor(net: INet, heartbeatMs: number = MM_LISTING_HEARTBEAT_MS) {
    this.net = net
    this.heartbeatMs = heartbeatMs
    this.net.on('list', payload => this.onListing(payload as PoolListing))
    // новый пир вошёл в пул — переобъявимся, чтобы он нас увидел
    this.net.onPeerJoin(() => { if (this.listing) this.net.broadcast('list', this.listing) })
  }

  /** ХОСТ: публиковать листинг (немедленно + heartbeat). */
  advertise(listing: PoolListing) {
    this.listing = listing
    this.net.broadcast('list', listing)
    if (!this.timer) {
      this.timer = setInterval(() => { if (this.listing) this.net.broadcast('list', this.listing) }, this.heartbeatMs)
    }
  }

  /** ХОСТ: снять листинг (слот занят / поиск остановлен / выход). */
  withdraw() {
    if (this.listing) this.net.broadcast('unlist', { code: this.listing.code })
    this.listing = null
    this.stopTimer()
  }

  /** КЛИЕНТ: искать совместимого хоста; onMatch(code) при первом подходящем. */
  search(filter: PoolFilter, onMatch: (code: string) => void) {
    this.filter = filter
    this.matchHandler = onMatch
    this.rejected.clear()
  }

  /** КЛИЕНТ: код не сработал (хост занят/исчез) — продолжить поиск, минуя его. */
  reject(code: string) { this.rejected.add(code) }

  /** КЛИЕНТ: прекратить поиск. */
  cancel() { this.filter = null; this.matchHandler = null }

  private onListing(listing: PoolListing) {
    if (!this.filter || !this.matchHandler) return
    if (this.rejected.has(listing.code)) return
    if (!listingMatches(this.filter, listing)) return
    const cb = this.matchHandler
    this.matchHandler = null   // один матч за вызов; дальнейшее — на стороне клиента
    this.filter = null
    cb(listing.code)
  }

  private stopTimer() { if (this.timer) { clearInterval(this.timer); this.timer = null } }

  dispose() { this.withdraw(); this.cancel(); this.net.leave() }
}
