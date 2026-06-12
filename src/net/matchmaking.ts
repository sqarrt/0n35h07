import type { MapId } from '../constants'

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
