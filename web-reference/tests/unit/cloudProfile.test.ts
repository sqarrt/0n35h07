import { describe, it, expect, beforeEach } from 'vitest'
import { parseCloudBlob, decideProfileSync, decideProfileSyncForUser, pushProfileToCloud, mergeSameDayTrial, type CloudBlob, type CloudStore } from '../../src/steam/cloudProfile'
import { loadProfile, type PlayerProfile } from '../../src/settings'

const PROFILE: PlayerProfile = loadProfile()   // a valid, sanitized profile to embed

function blob(updatedAt: number): CloudBlob { return { v: 1, updatedAt, profile: PROFILE } }

describe('parseCloudBlob', () => {
  it('parses a valid v1 blob', () => {
    const b = parseCloudBlob(JSON.stringify(blob(42)))
    expect(b?.updatedAt).toBe(42)
    expect(b?.profile).toBeTruthy()
  })
  it('rejects null / garbage / wrong version / missing fields', () => {
    expect(parseCloudBlob(null)).toBeNull()
    expect(parseCloudBlob('not json')).toBeNull()
    expect(parseCloudBlob(JSON.stringify({ v: 2, updatedAt: 1, profile: PROFILE }))).toBeNull()
    expect(parseCloudBlob(JSON.stringify({ v: 1, profile: PROFILE }))).toBeNull()
    expect(parseCloudBlob(JSON.stringify({ v: 1, updatedAt: 1 }))).toBeNull()
  })
})

describe('decideProfileSync (last-write-wins)', () => {
  it('no cloud → push local up', () => {
    expect(decideProfileSync(null, 5)).toEqual({ kind: 'push' })
  })
  it('cloud newer → adopt', () => {
    const d = decideProfileSync(blob(10), 5)
    expect(d.kind).toBe('adopt')
    if (d.kind === 'adopt') expect(d.updatedAt).toBe(10)
  })
  it('local newer → push', () => {
    expect(decideProfileSync(blob(3), 5)).toEqual({ kind: 'push' })
  })
  it('equal → noop', () => {
    expect(decideProfileSync(blob(5), 5)).toEqual({ kind: 'noop' })
  })
})

describe('decideProfileSyncForUser (identity-aware)', () => {
  const base = { cloud: null, localTs: 0, localOwner: null, currentUser: null, hasLocalProfile: false }
  it('Steam недоступен → LWW (как раньше)', () => {
    expect(decideProfileSyncForUser({ ...base, cloud: blob(10), localTs: 5, currentUser: null }).kind).toBe('adopt')
    expect(decideProfileSyncForUser({ ...base, cloud: blob(3), localTs: 5, currentUser: null })).toEqual({ kind: 'push' })
  })
  it('тег отсутствует + есть профиль (обновление) → LWW, данные не сбрасываются', () => {
    expect(decideProfileSyncForUser({ ...base, currentUser: 'A', hasLocalProfile: true, cloud: blob(3), localTs: 5 })).toEqual({ kind: 'push' })
    expect(decideProfileSyncForUser({ ...base, currentUser: 'A', hasLocalProfile: true, cloud: blob(9), localTs: 5 }).kind).toBe('adopt')
  })
  it('тег отсутствует + нет профиля (чистая установка) → fresh без облака / adopt с облаком', () => {
    expect(decideProfileSyncForUser({ ...base, currentUser: 'A', hasLocalProfile: false, cloud: null })).toEqual({ kind: 'fresh' })
    expect(decideProfileSyncForUser({ ...base, currentUser: 'A', hasLocalProfile: false, cloud: blob(7) }).kind).toBe('adopt')
  })
  it('наш аккаунт → LWW', () => {
    expect(decideProfileSyncForUser({ ...base, currentUser: 'A', localOwner: 'A', hasLocalProfile: true, cloud: blob(3), localTs: 5 })).toEqual({ kind: 'push' })
    expect(decideProfileSyncForUser({ ...base, currentUser: 'A', localOwner: 'A', hasLocalProfile: true, cloud: blob(5), localTs: 5 })).toEqual({ kind: 'noop' })
  })
  it('другой аккаунт → игнор локали: adopt при облаке, fresh без', () => {
    expect(decideProfileSyncForUser({ ...base, currentUser: 'B', localOwner: 'A', hasLocalProfile: true, cloud: blob(1), localTs: 999 }).kind).toBe('adopt')
    expect(decideProfileSyncForUser({ ...base, currentUser: 'B', localOwner: 'A', hasLocalProfile: true, cloud: null, localTs: 999 })).toEqual({ kind: 'fresh' })
  })
})

describe('pushProfileToCloud', () => {
  beforeEach(() => localStorage.clear())
  it('writes a v1 blob and bumps the local stamp', () => {
    const writes: Array<[string, string]> = []
    const store: CloudStore = { read: async () => null, write: async (n, d) => { writes.push([n, d]); return true } }
    pushProfileToCloud(PROFILE, store)
    expect(writes).toHaveLength(1)
    expect(writes[0][0]).toBe('profile.json')
    const parsed = parseCloudBlob(writes[0][1])
    expect(parsed?.v).toBe(1)
    expect(parsed?.updatedAt).toBeGreaterThan(0)
    // local stamp now matches the uploaded blob → next boot would be a 'noop'
    expect(decideProfileSync(parsed, Number(localStorage.getItem('oneshot:profile:updatedAt')))).toEqual({ kind: 'noop' })
  })
})

describe('mergeSameDayTrial — anti stale-machine reset', () => {
  const prof = (over: Partial<PlayerProfile>): PlayerProfile => ({ ...loadProfile(), ...over })
  it('keeps the MAX gens/saves for the same trial day', () => {
    const local = prof({ radioTrial: { day: '2026-06-28', gens: 8, saves: 4 } })
    const cloud = prof({ radioTrial: { day: '2026-06-28', gens: 3, saves: 1 } })
    expect(mergeSameDayTrial(cloud, local).radioTrial).toEqual({ day: '2026-06-28', gens: 8, saves: 4 })
  })
  it('different day → adopted cloud trial as-is', () => {
    const local = prof({ radioTrial: { day: '2026-06-27', gens: 8, saves: 4 } })
    const cloud = prof({ radioTrial: { day: '2026-06-28', gens: 1, saves: 0 } })
    expect(mergeSameDayTrial(cloud, local).radioTrial).toEqual({ day: '2026-06-28', gens: 1, saves: 0 })
  })
  it('missing trial on either side → adopted unchanged', () => {
    const local = prof({ radioTrial: undefined })
    const cloud = prof({ radioTrial: { day: '2026-06-28', gens: 2, saves: 1 } })
    expect(mergeSameDayTrial(cloud, local).radioTrial).toEqual({ day: '2026-06-28', gens: 2, saves: 1 })
  })
})
