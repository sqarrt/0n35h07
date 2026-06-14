import type { MapId, MapFilter, DurationFilter } from '../constants'
import type { IDiscovery } from './discovery/IDiscovery'

export type { MapFilter, DurationFilter }   // ре-экспорт (совместимость)

/** Объявление хоста в пуле: код его комнаты + наборы готовых карт/длительностей (≥1 в каждом). */
export interface PoolListing {
  code: string
  name: string
  color: string
  map: MapFilter            // набор карт хоста (на коннекте выберется случайная из пересечения с клиентом)
  durationMin: DurationFilter
  dual: boolean             // владелец листинга тоже ищет (режим both) — для разрывателя ничьей
}

/** Что готов принять клиент: наборы карт/длительностей (матч есть, если пересекается с набором хоста). */
export interface PoolFilter {
  map: MapFilter
  durationMin: DurationFilter
}

/** Пересечение наборов (порядок — как в первом). */
function intersect<T>(a: readonly T[], b: readonly T[]): T[] {
  return a.filter(x => b.includes(x))
}

/** Листинг подходит фильтру, если пересекаются и карты, и длительности (есть взаимно приемлемый вариант). */
export function listingMatches(filter: PoolFilter, listing: PoolListing): boolean {
  return intersect(filter.map, listing.map).length > 0 && intersect(filter.durationMin, listing.durationMin).length > 0
}

/** Финальные параметры матча (host-authoritative): случайные из пересечения наборов хоста и клиента. */
export function resolveMatchParams(
  host: PoolFilter,
  client: PoolFilter,
  pickMap: (opts: MapId[]) => MapId,
  pickDuration: (opts: number[]) => number,
): { mapId: MapId; durationMin: number } {
  return {
    mapId: pickMap(intersect(host.map, client.map)),
    durationMin: pickDuration(intersect(host.durationMin, client.durationMin)),
  }
}

/** Ключ корзины discovery по конкретным карте+времени внутри неймспейса (версия+платформа). */
export function bucketKey(map: MapId, durationMin: number, namespace: string): string {
  return `mm:${namespace}:${map}:${durationMin}`
}

/** Корзины, в которые ХОСТ публикует листинг: кросс-произведение выбранных карт × длительностей (в неймспейсе). */
export function bucketsForListing(map: MapFilter, durationMin: DurationFilter, namespace: string): string[] {
  return map.flatMap(m => durationMin.map(d => bucketKey(m, d, namespace)))
}

/** Корзины, на которые КЛИЕНТ подписывается: те же правила, что у листинга. */
export function bucketsForFilter(map: MapFilter, durationMin: DurationFilter, namespace: string): string[] {
  return bucketsForListing(map, durationMin, namespace)
}

/**
 * Слой подбора поверх IDiscovery (pub/sub по корзинам, без mesh). Хост фанит листинг во все
 * совместимые корзины; клиент подписывается на корзины фильтра и берёт первый совместимый листинг.
 * Реальный матч идёт через обычный RoomSession по этому коду — пул только discovery.
 */
export class MatchmakingPool {
  private disco: IDiscovery
  private namespace: string                  // версия+платформа: пулы разных версий/платформ не пересекаются
  private listing: PoolListing | null = null
  private listingBuckets: string[] = []
  private unsubs: Array<() => void> = []
  private filter: PoolFilter | null = null
  private matchHandler: ((listing: PoolListing) => boolean) | null = null
  private rejected = new Set<string>()

  constructor(disco: IDiscovery, namespace: string) { this.disco = disco; this.namespace = namespace }

  /** ХОСТ: опубликовать листинг во все совместимые корзины (фан по «any»-осям). */
  advertise(listing: PoolListing) {
    this.withdraw()
    this.listing = listing
    this.listingBuckets = bucketsForListing(listing.map, listing.durationMin, this.namespace)
    for (const b of this.listingBuckets) this.disco.publish(b, listing)
  }

  /** ХОСТ: снять листинг из всех корзин (слот занят / поиск остановлен / выход). */
  withdraw() {
    if (this.listing) for (const b of this.listingBuckets) this.disco.withdraw(b, this.listing.code)
    this.listing = null
    this.listingBuckets = []
  }

  /** КЛИЕНТ: подписаться на корзины фильтра; onMatch(listing)→true консьюмит (поиск стоп), →false — слушаем дальше. */
  search(filter: PoolFilter, onMatch: (listing: PoolListing) => boolean) {
    this.cancel()
    this.filter = filter
    this.matchHandler = onMatch
    for (const b of bucketsForFilter(filter.map, filter.durationMin, this.namespace)) {
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
    if (this.matchHandler(listing)) this.cancel()       // консьюм → отписка; иначе продолжаем слушать
  }

  dispose() { this.withdraw(); this.cancel() }
}
