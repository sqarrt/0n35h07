import { useSyncExternalStore } from 'react'
import { subscribe, getStatus } from '../net/relays'
import type { RelayStatus } from '../net/relays'

/** Reactive snapshot of the relay probe status (store lives in src/net/relays.ts, outside React). */
export function useRelayStatus(): RelayStatus {
  return useSyncExternalStore(subscribe, getStatus, getStatus)
}
