import type { INet } from './INet'
import { BroadcastChannelNet } from './BroadcastChannelNet'
import { TrysteroNet } from './TrysteroNet'
import { LagNet } from './LagNet'
import { NET_ICE_SERVERS } from '../constants'
import { resolveRelaysSync } from './relays'

export type NetKind = 'bc' | 'trystero' | 'bc-lag'   // bc-lag: BroadcastChannel wrapped in artificial latency (dev/e2e)

const DEFAULT_LAG_MS = 80, DEFAULT_JITTER_MS = 20

/**
 * Transport selection: ?net= → defaults to Trystero (internet P2P). URL param only, no localStorage —
 * so the transport doesn't persistently "stick" across sessions. e2e forces 'bc' via ?net=bc (see tests/fixtures).
 * ?net=bc-lag&lagMs=80&jitterMs=20 → BroadcastChannel under artificial latency (dev/e2e for prediction/interp).
 */
export function resolveNetKind(): NetKind {
  const q = new URLSearchParams(window.location.search).get('net')
  if (q === 'bc' || q === 'trystero' || q === 'bc-lag') return q
  return 'trystero'
}

/** Transport factory by room code. */
export function createNet(code: string): INet {
  const kind = resolveNetKind()
  if (kind === 'bc') return new BroadcastChannelNet(code)
  if (kind === 'bc-lag') {
    const p = new URLSearchParams(window.location.search)
    const lag = Number(p.get('lagMs') ?? DEFAULT_LAG_MS), jit = Number(p.get('jitterMs') ?? DEFAULT_JITTER_MS)
    return new LagNet(new BroadcastChannelNet(code), Number.isFinite(lag) ? lag : DEFAULT_LAG_MS, Number.isFinite(jit) ? jit : DEFAULT_JITTER_MS)
  }
  return new TrysteroNet(code, resolveRelaysSync(), NET_ICE_SERVERS)
}
