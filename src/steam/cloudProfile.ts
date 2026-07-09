import { IS_DESKTOP } from '../platform'
import type { PlayerProfile } from '../settings'
import { loadProfile, saveProfile, setProfileSaveHook, randomProfile, chooseFirstRunName, isFirstRun } from '../settings'
import { lsGet, lsSet } from '../storage'
import { cloudRead, cloudWrite, getSteamUser } from './steam'

const CLOUD_FILE = 'profile.json'
const LOCAL_TS_KEY = 'oneshot:profile:updatedAt'   // local mirror of the cloud blob's updatedAt
const LOCAL_OWNER_KEY = 'oneshot:profile:owner'    // SteamID that owns the cached local profile (local-only)
const BLOB_VERSION = 1
const PUSH_DEBOUNCE_MS = 1000                       // coalesce rapid setting changes into one upload
const READ_TIMEOUT_MS = 1500                        // boot never blocks longer than this on the cloud read
const USER_TIMEOUT_MS = 1500                        // boot never blocks longer than this on the Steam user read

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
function localOwner(): string | null { return lsGet(LOCAL_OWNER_KEY) }
function setLocalOwner(id: string): void { lsSet(LOCAL_OWNER_KEY, id) }

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

/** Identity-aware decision: bind the profile to the current Steam account on top of LWW.
 *  'fresh' — first run for this account → new profile seeded with the Steam persona name. */
export type IdentitySyncDecision = SyncDecision | { kind: 'fresh' }

export interface ProfileSyncContext {
  cloud: CloudBlob | null
  localTs: number
  localOwner: string | null       // SteamID owning the cached local profile (null = tag not set)
  currentUser: string | null      // current SteamID (null = Steam unavailable)
  hasLocalProfile: boolean         // whether a profile already exists in localStorage
}
export function decideProfileSyncForUser(ctx: ProfileSyncContext): IdentitySyncDecision {
  const { cloud, localTs, localOwner, currentUser, hasLocalProfile } = ctx
  if (currentUser == null) return decideProfileSync(cloud, localTs)              // Steam unknown → plain LWW
  if (localOwner == null && hasLocalProfile) return decideProfileSync(cloud, localTs)  // pre-tag profile (upgrade) → don't disturb
  if (localOwner === currentUser) return decideProfileSync(cloud, localTs)       // our account → LWW
  // Either the tag is missing with no local profile (first run for this account), or a confirmed
  // account switch — ignore any local cache and take the account's cloud, else start fresh.
  return cloud ? { kind: 'adopt', profile: cloud.profile, updatedAt: cloud.updatedAt } : { kind: 'fresh' }
}

/** When ADOPTING the cloud profile, a stale machine must not "refund" the radio trial: for the SAME local day,
 *  keep the HIGHER gens/saves of (adopted cloud, local). Different day / missing trial → adopted as-is. Pure. */
export function mergeSameDayTrial(adopted: PlayerProfile, local: PlayerProfile): PlayerProfile {
  const a = adopted.radioTrial, l = local.radioTrial
  if (!a || !l || a.day !== l.day) return adopted
  return { ...adopted, radioTrial: { day: a.day, gens: Math.max(a.gens, l.gens), saves: Math.max(a.saves, l.saves) } }
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
export async function syncProfileOnStartup(store: CloudStore = steamStore, getUser = getSteamUser): Promise<void> {
  if (!IS_DESKTOP) return
  const u = await withTimeout(getUser(), USER_TIMEOUT_MS, null)
  const currentUser = u?.id ?? null
  const raw = await withTimeout(store.read(CLOUD_FILE), READ_TIMEOUT_MS, null)
  const decision = decideProfileSyncForUser({
    cloud: parseCloudBlob(raw), localTs: localUpdatedAt(), localOwner: localOwner(),
    currentUser, hasLocalProfile: !isFirstRun(),
  })
  // Only skip the trial-merge on a CONFIRMED account switch (else keep the anti-refund merge as before).
  const differentAccount = currentUser != null && localOwner() != null && localOwner() !== currentUser
  if (decision.kind === 'adopt') {
    const merged = differentAccount ? decision.profile : mergeSameDayTrial(decision.profile, loadProfile())
    saveProfile(merged)
    setLocalUpdatedAt(decision.updatedAt)    // mark this version as our synced baseline
  } else if (decision.kind === 'push') {
    pushProfileToCloud(loadProfile(), store)
  } else if (decision.kind === 'fresh') {
    // First run for this account: fresh profile, name seeded from the Steam persona name; establish the cloud.
    const p = randomProfile()
    p.name = chooseFirstRunName(true, u?.name ?? null, p.name)
    saveProfile(p)
    pushProfileToCloud(p, store)
  }
  if (currentUser != null) setLocalOwner(currentUser)
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
