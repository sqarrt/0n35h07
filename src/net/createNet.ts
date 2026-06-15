import type { INet } from './INet'
import { BroadcastChannelNet } from './BroadcastChannelNet'
import { TrysteroNet } from './TrysteroNet'
import { NET_ICE_SERVERS } from '../constants'
import { resolveRelaysSync } from './relays'

export type NetKind = 'bc' | 'trystero'

/**
 * Выбор транспорта: ?net= → по умолчанию Trystero (интернет-P2P). Только URL-параметр, без localStorage —
 * чтобы транспорт не «залипал» персистентно между сессиями. e2e форсят 'bc' через ?net=bc (см. tests/fixtures).
 */
export function resolveNetKind(): NetKind {
  const q = new URLSearchParams(window.location.search).get('net')
  if (q === 'bc' || q === 'trystero') return q
  return 'trystero'
}

/** Фабрика транспорта по коду комнаты. */
export function createNet(code: string): INet {
  return resolveNetKind() === 'bc'
    ? new BroadcastChannelNet(code)
    : new TrysteroNet(code, resolveRelaysSync(), NET_ICE_SERVERS)
}
