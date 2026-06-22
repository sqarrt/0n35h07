import { describe, it, expect } from 'vitest'
import { CLIENT_PLATFORM, CLIENT_VERSION, POOL_NAMESPACE } from '../../src/net/poolNamespace'

describe('poolNamespace', () => {
  it('platform in the test environment (jsdom, not Tauri) is browser', () => {
    expect(CLIENT_PLATFORM).toBe('browser')
  })

  it('version = build-time __APP_VERSION__ (non-empty string)', () => {
    expect(typeof CLIENT_VERSION).toBe('string')
    expect(CLIENT_VERSION.length).toBeGreaterThan(0)
  })

  it('pool namespace = version:platform', () => {
    expect(POOL_NAMESPACE).toBe(`${CLIENT_VERSION}:browser`)
  })
})
