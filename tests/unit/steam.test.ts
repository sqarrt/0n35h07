import { describe, it, expect } from 'vitest'
import { isSteamAvailable, getSteamUser, unlockAchievement, cloudRead, cloudWrite, cloudDelete } from '../../src/steam/steam'

// jsdom has no __TAURI_INTERNALS__ → IS_DESKTOP is false → the wrapper must report
// "unavailable" WITHOUT importing or invoking Tauri (web + tests never need Steam).
describe('steam wrapper — off-desktop fallback', () => {
  it('reports Steam unavailable', async () => {
    await expect(isSteamAvailable()).resolves.toBe(false)
  })
  it('returns no Steam user', async () => {
    await expect(getSteamUser()).resolves.toBeNull()
  })
  it('achievement unlock / cloud ops are harmless no-ops off-desktop', async () => {
    await expect(unlockAchievement('ACH_X')).resolves.toBe(false)
    await expect(cloudRead('profile.json')).resolves.toBeNull()
    await expect(cloudWrite('profile.json', '{}')).resolves.toBe(false)
    await expect(cloudDelete('profile.json')).resolves.toBe(false)
  })
})
