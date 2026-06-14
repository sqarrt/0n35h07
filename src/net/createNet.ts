import type { INet } from './INet'
import { BroadcastChannelNet } from './BroadcastChannelNet'
import { TrysteroNet } from './TrysteroNet'
import { NET_ICE_SERVERS } from '../constants'
import { resolveRelaysSync } from './relays'
import { lsGet } from '../storage'

export type NetKind = 'bc' | 'trystero'

/**
 * Выбор транспорта: ?net= → localStorage('oneshot:net') → по умолчанию Trystero (интернет-P2P).
 * e2e/локальная отладка форсят 'bc' (BroadcastChannel — same-origin, без внешних трекеров).
 */
export function resolveNetKind(): NetKind {
  const q = new URLSearchParams(window.location.search).get('net')
  if (q === 'bc' || q === 'trystero') return q
  const ls = lsGet('oneshot:net')
  if (ls === 'bc' || ls === 'trystero') return ls
  return 'trystero'
}

/** Фабрика транспорта по коду комнаты. */
export function createNet(code: string): INet {
  return resolveNetKind() === 'bc'
    ? new BroadcastChannelNet(code)
    : new TrysteroNet(code, resolveRelaysSync(), NET_ICE_SERVERS)
}
