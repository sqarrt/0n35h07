import { useSyncExternalStore } from 'react'
import { subscribe, getStatus } from '../net/relays'
import type { RelayStatus } from '../net/relays'

/** Реактивный снимок статуса пробы релеев (стор живёт в src/net/relays.ts, вне React). */
export function useRelayStatus(): RelayStatus {
  return useSyncExternalStore(subscribe, getStatus, getStatus)
}
