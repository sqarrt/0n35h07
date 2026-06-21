import type { INet } from './INet'
import { BroadcastChannelNet } from './BroadcastChannelNet'
import { TrysteroNet } from './TrysteroNet'
import { NET_ICE_SERVERS } from '../constants'
import { resolveRelaysSync } from './relays'

export type NetKind = 'bc' | 'trystero'

/**
 * Transport selection: ?net= → defaults to Trystero (internet P2P). URL param only, no localStorage —
 * so the transport doesn't persistently "stick" across sessions. e2e forces 'bc' via ?net=bc (see tests/fixtures).
 */
export function resolveNetKind(): NetKind {
  const q = new URLSearchParams(window.location.search).get('net')
  if (q === 'bc' || q === 'trystero') return q
  return 'trystero'
}

/** Transport factory by room code. */
export function createNet(code: string): INet {
  return resolveNetKind() === 'bc'
    ? new BroadcastChannelNet(code)
    : new TrysteroNet(code, resolveRelaysSync(), NET_ICE_SERVERS)
}
