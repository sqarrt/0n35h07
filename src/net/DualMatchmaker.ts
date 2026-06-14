import type { MatchmakingPool, PoolListing, PoolFilter } from './matchmaking'
import type { SearchRole } from '../settings'
import { netDiagMark } from './netDiag'

export type ResolvedRole = 'host' | 'client'

export interface DualMatchmakerOpts {
  pool: MatchmakingPool
  mode: SearchRole                     // 'both' (хост/клиент как повезёт) | 'client' (только ищем)
  code: string                         // наш host-код (advertise + разрыватель ничьей)
  listing: Omit<PoolListing, 'dual'>   // что публикуем (флаг dual проставит сам класс)
  filter: PoolFilter                   // что ищем
}

/**
 * Оркестратор подбора «сразу в двух ролях». В режиме both одновременно анонсирует наш листинг
 * (dual:true) и ищет чужие; при встрече двух dual-пиров ровно один становится клиентом
 * (детерминированно по коду: меньший код остаётся хостом). Защёлка committed (first-wins):
 * первый разрешившийся путь — входящий к нашей host-сессии (hostConnected) ЛИБО наш join —
 * фиксирует роль, второй путь становится no-op. RoomSession'ами владеет App; класс — только пул.
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

  /** App: наш поиск решил, что мы заходим клиентом на чужой код. */
  onJoin(cb: (code: string) => void) { this.joinCb = cb }

  /** Запустить подбор согласно режиму. */
  start() {
    netDiagMark('mm:start', { mode: this.mode, code: this.code })
    if (this.mode === 'both') this.pool.advertise({ ...this.listing, dual: true })   // 'оба' хостит и ищет
    this.pool.search(this.filter, l => this.onCandidate(l))                          // и 'оба', и 'client' ищут
  }

  /** App: к нашей host-сессии подключился соперник → фиксируем host, гасим листинг/поиск. */
  hostConnected() {
    if (this.committed) return
    this.committed = 'host'
    this.pool.withdraw()
    this.pool.cancel()
  }

  /** Полная остановка (СТОП / выход / смена роли). */
  stop() { this.pool.withdraw(); this.pool.cancel() }

  get resolved(): ResolvedRole | null { return this.committed }

  /** @returns true — кандидат поглощён (поиск стоп); false — отложен (ищем дальше, остаёмся хостом). */
  private onCandidate(listing: PoolListing): boolean {
    netDiagMark('mm:candidate', { code: listing.code, dual: listing.dual })
    if (this.committed) return true
    if (listing.code === this.code) return false   // свой же листинг (эхо шины) — игнорируем, слушаем дальше
    // both + dual-пир + наш код меньше → остаёмся хостом, ждём его как клиента.
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
