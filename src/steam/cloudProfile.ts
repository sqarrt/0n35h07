import { IS_DESKTOP } from '../platform'
import type { PlayerProfile } from '../settings'
import { loadProfile, saveProfile, setProfileSaveHook } from '../settings'
import { lsGet, lsSet } from '../storage'
import { cloudRead, cloudWrite } from './steam'

const CLOUD_FILE = 'profile.json'
const LOCAL_TS_KEY = 'oneshot:profile:updatedAt'   // local mirror of the cloud blob's updatedAt
const BLOB_VERSION = 1
const PUSH_DEBOUNCE_MS = 1000                       // coalesce rapid setting changes into one upload
const READ_TIMEOUT_MS = 1500                        // boot never blocks longer than this on the cloud read

/** What Steam Cloud stores: a versioned wrapper around the profile + a wall-clock stamp. */
export interface CloudBlob { v: number; updatedAt: number; profile: PlayerProfile }

/** Transport seam (overridable in tests); defaults to the real Steam bridge. */
export interface CloudStore {
  read(name: string): Promise<string | null>
  write(name: string, data: string): Promise<boolean>
}
const steamStore: CloudStore = { read: cloudRead, write: cloudWrite }

function localUpdatedAt(): number {
  const n = Number(lsGet(LOCAL_TS_KEY))
  return Number.isFinite(n) ? n : 0
}
function setLocalUpdatedAt(t: number): void {
  lsSet(LOCAL_TS_KEY, String(t))
}

/** Parse a raw cloud file into a CloudBlob, or null if absent/garbage/wrong version. */
export function parseCloudBlob(raw: string | null): CloudBlob | null {
  if (!raw) return null
  try {
    const b = JSON.parse(raw) as Partial<CloudBlob>
    if (b.v !== BLOB_VERSION) return null
    if (typeof b.updatedAt !== 'number' || !Number.isFinite(b.updatedAt)) return null
    if (typeof b.profile !== 'object' || b.profile == null) return null
    return { v: BLOB_VERSION, updatedAt: b.updatedAt, profile: b.profile as PlayerProfile }
  } catch { return null }
}

/** Pure last-write-wins decision (no I/O) — easy to test in isolation. */
export type SyncDecision =
  | { kind: 'adopt'; profile: PlayerProfile; updatedAt: number }   // cloud is newer → take it
  | { kind: 'push' }                                               // local is newer / no cloud → upload local
  | { kind: 'noop' }                                               // already in sync
export function decideProfileSync(cloud: CloudBlob | null, localTs: number): SyncDecision {
  if (!cloud) return { kind: 'push' }
  if (cloud.updatedAt > localTs) return { kind: 'adopt', profile: cloud.profile, updatedAt: cloud.updatedAt }
  if (cloud.updatedAt < localTs) return { kind: 'push' }
  return { kind: 'noop' }
}

/** Upload the profile to the cloud and bump the local stamp. Fire-and-forget; no-op off-Steam. */
export function pushProfileToCloud(profile: PlayerProfile, store: CloudStore = steamStore): void {
  const updatedAt = Date.now()
  setLocalUpdatedAt(updatedAt)
  const blob: CloudBlob = { v: BLOB_VERSION, updatedAt, profile }
  void store.write(CLOUD_FILE, JSON.stringify(blob))
}

function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>(resolve => setTimeout(() => resolve(fallback), ms))])
}

/** Reconcile the local profile with the cloud at startup. Must run BEFORE the app reads the
 *  profile (so an adopted cloud profile is already in localStorage). No-op off-Steam. */
export async function syncProfileOnStartup(store: CloudStore = steamStore): Promise<void> {
  if (!IS_DESKTOP) return
  const raw = await withTimeout(store.read(CLOUD_FILE), READ_TIMEOUT_MS, null)
  const decision = decideProfileSync(parseCloudBlob(raw), localUpdatedAt())
  if (decision.kind === 'adopt') {
    saveProfile(decision.profile)            // sanitize + persist locally
    setLocalUpdatedAt(decision.updatedAt)    // mark this version as our synced baseline
  } else if (decision.kind === 'push') {
    pushProfileToCloud(loadProfile(), store)
  }
}

/** Register a debounced cloud push on every profile save. Call once, AFTER syncProfileOnStartup
 *  (so adopting the cloud profile doesn't echo straight back). No-op off-Steam. */
export function installProfileCloudSync(store: CloudStore = steamStore): void {
  if (!IS_DESKTOP) return
  let timer: ReturnType<typeof setTimeout> | null = null
  let pending: PlayerProfile | null = null
  setProfileSaveHook(profile => {
    pending = profile
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => { timer = null; if (pending) pushProfileToCloud(pending, store) }, PUSH_DEBOUNCE_MS)
  })
}
