import { describe, it, expect, beforeEach } from 'vitest'
import { parseCloudBlob, decideProfileSync, pushProfileToCloud, type CloudBlob, type CloudStore } from '../../src/steam/cloudProfile'
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
