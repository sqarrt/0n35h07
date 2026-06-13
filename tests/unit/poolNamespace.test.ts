import { describe, it, expect } from 'vitest'
import { CLIENT_PLATFORM, CLIENT_VERSION, POOL_NAMESPACE } from '../../src/net/poolNamespace'

describe('poolNamespace', () => {
  it('платформа в тестовой среде (jsdom, не Tauri) — browser', () => {
    expect(CLIENT_PLATFORM).toBe('browser')
  })

  it('версия = build-time __APP_VERSION__ (непустая строка)', () => {
    expect(typeof CLIENT_VERSION).toBe('string')
    expect(CLIENT_VERSION.length).toBeGreaterThan(0)
  })

  it('неймспейс пула = версия:платформа', () => {
    expect(POOL_NAMESPACE).toBe(`${CLIENT_VERSION}:browser`)
  })
})
