import type { MapId } from '../constants'
import { MATCH_DURATIONS_MIN } from '../constants'
import { MAP_IDS } from '../game/maps'
import type { IDiscovery } from './discovery/IDiscovery'

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
 * Слой подбора поверх IDiscovery (pub/sub по корзинам, без mesh). Хост фанит листинг во все
 * совместимые корзины; клиент подписывается на корзины фильтра и берёт первый совместимый листинг.
 * Реальный матч идёт через обычный RoomSession по этому коду — пул только discovery.
 */
export class MatchmakingPool {
  private disco: IDiscovery
  private listing: PoolListing | null = null
  private listingBuckets: string[] = []
  private unsubs: Array<() => void> = []
  private filter: PoolFilter | null = null
  private matchHandler: ((code: string) => void) | null = null
  private rejected = new Set<string>()

  constructor(disco: IDiscovery) { this.disco = disco }

  /** ХОСТ: опубликовать листинг во все совместимые корзины (фан по «any»-осям). */
  advertise(listing: PoolListing) {
    this.withdraw()
    this.listing = listing
    this.listingBuckets = bucketsForListing(listing.map, listing.durationMin)
    for (const b of this.listingBuckets) this.disco.publish(b, listing)
  }

  /** ХОСТ: снять листинг из всех корзин (слот занят / поиск остановлен / выход). */
  withdraw() {
    if (this.listing) for (const b of this.listingBuckets) this.disco.withdraw(b, this.listing.code)
    this.listing = null
    this.listingBuckets = []
  }

  /** КЛИЕНТ: подписаться на корзины фильтра; onMatch(code) на первом совместимом (минуя отклонённые). */
  search(filter: PoolFilter, onMatch: (code: string) => void) {
    this.cancel()
    this.filter = filter
    this.matchHandler = onMatch
    for (const b of bucketsForFilter(filter.map, filter.durationMin)) {
      this.unsubs.push(this.disco.subscribe(b, l => this.onListing(l)))
    }
  }

  /** КЛИЕНТ: код не сработал (хост занят/исчез) — пропускать его в дальнейшем поиске. */
  reject(code: string) { this.rejected.add(code) }

  /** КЛИЕНТ: прекратить поиск (отписаться от всех корзин). */
  cancel() {
    for (const off of this.unsubs) off()
    this.unsubs = []
    this.filter = null
    this.matchHandler = null
  }

  private onListing(listing: PoolListing) {
    if (!this.filter || !this.matchHandler) return
    if (this.rejected.has(listing.code)) return
    if (!listingMatches(this.filter, listing)) return   // подстраховка (корзины уже отфильтровали)
    const cb = this.matchHandler
    this.cancel()
    cb(listing.code)
  }

  dispose() { this.withdraw(); this.cancel() }
}
