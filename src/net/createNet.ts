import type { INet } from './INet'
import { BroadcastChannelNet } from './BroadcastChannelNet'

export type NetKind = 'bc' | 'trystero'

/** Транспорт из ?net= (по умолчанию BroadcastChannel — для e2e и игры «в две вкладки»). */
export function resolveNetKind(): NetKind {
  const p = new URLSearchParams(window.location.search).get('net')
  return p === 'trystero' ? 'trystero' : 'bc'
}

/**
 * Фабрика транспорта по коду лобби. Пока всегда BroadcastChannel (same-origin);
 * TrysteroNet (интернет-P2P) подключим отдельным этапом и выберем по resolveNetKind().
 */
export function createNet(code: string): INet {
  return new BroadcastChannelNet(code)
}
