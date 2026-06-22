import { describe, it, expect } from 'vitest'
import { isSteamAvailable, getSteamUser, unlockAchievement, cloudRead, cloudWrite, cloudDelete, steamFriendsList, steamInviteToLobby } from '../../src/steam/steam'
import { hostFriendLobby, joinSteamLobby } from '../../src/steam/SteamLobby'

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
  it('friends list / invite / lobby hosting are inert off-desktop', async () => {
    await expect(steamFriendsList()).resolves.toEqual([])
    await expect(steamInviteToLobby('123')).resolves.toBe(false)
    await expect(hostFriendLobby()).resolves.toBeNull()       // no SteamID → null
    await expect(joinSteamLobby('456')).resolves.toBeNull()
  })
})
