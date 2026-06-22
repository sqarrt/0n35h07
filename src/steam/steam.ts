import { IS_DESKTOP } from '../platform'

export interface SteamUser { id: string; name: string }

// Tauri's invoke is imported lazily and ONLY on desktop, so the browser bundle never
// pulls it in and the unit tests never touch it.
async function invokeSteam<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

/** True only inside the Tauri desktop app AND when the Steam SDK initialized. */
export async function isSteamAvailable(): Promise<boolean> {
  if (!IS_DESKTOP) return false
  try { return await invokeSteam<boolean>('steam_available') }
  catch { return false }
}

/** The local Steam user (SteamID64 as a string + persona name), or null if unavailable. */
export async function getSteamUser(): Promise<SteamUser | null> {
  if (!IS_DESKTOP) return null
  try { return await invokeSteam<SteamUser | null>('steam_user') }
  catch { return null }
}

/** Unlock a Steam achievement by its API name. Resolves to false off-desktop / without Steam
 *  (the call is a harmless no-op — Steam's set() is itself idempotent). */
export async function unlockAchievement(apiName: string): Promise<boolean> {
  if (!IS_DESKTOP) return false
  try { return await invokeSteam<boolean>('steam_unlock_achievement', { name: apiName }) }
  catch { return false }
}

/** Read a Steam Cloud file as text, or null off-desktop / missing / on error. */
export async function cloudRead(name: string): Promise<string | null> {
  if (!IS_DESKTOP) return null
  try { return await invokeSteam<string | null>('steam_cloud_read', { name }) }
  catch { return null }
}

/** Write a Steam Cloud file (overwrites). Resolves to false off-desktop / on error. */
export async function cloudWrite(name: string, data: string): Promise<boolean> {
  if (!IS_DESKTOP) return false
  try { return await invokeSteam<boolean>('steam_cloud_write', { name, data }) }
  catch { return false }
}

/** Delete a Steam Cloud file. Resolves to false off-desktop / on error. */
export async function cloudDelete(name: string): Promise<boolean> {
  if (!IS_DESKTOP) return false
  try { return await invokeSteam<boolean>('steam_cloud_delete', { name }) }
  catch { return false }
}

/** Set (value=null clears) a Steam Rich Presence key shown in the friends list. No-op off-desktop. */
export async function setRichPresence(key: string, value: string | null): Promise<boolean> {
  if (!IS_DESKTOP) return false
  try { return await invokeSteam<boolean>('steam_set_rich_presence', { key, value }) }
  catch { return false }
}

// --- Steam matchmaking + networking (sub-project #4) ---

/** Events streamed from the Rust networking pump over the "steam-net" Tauri event. */
export type SteamNetEvent =
  | { kind: 'message'; from: string; data: string }
  | { kind: 'peerJoin'; steamId: string }
  | { kind: 'peerLeave'; steamId: string }
  | { kind: 'lobbyEntered'; lobbyId: string; self: string; members: string[] }
  | { kind: 'joinRequested'; lobbyId: string }

/** Our own SteamID64 (string), or null off-desktop / without Steam. */
export async function steamNetSelf(): Promise<string | null> {
  if (!IS_DESKTOP) return null
  try { return await invokeSteam<string | null>('steam_net_self') }
  catch { return null }
}

/** Create a Private 1v1 lobby (result arrives as a 'lobbyEntered' event). */
export async function steamNetCreateLobby(): Promise<void> {
  if (!IS_DESKTOP) return
  try { await invokeSteam<void>('steam_net_create_lobby') } catch { /* ignore */ }
}

/** Join a lobby by id (from a 'joinRequested' event); result arrives as 'lobbyEntered'. */
export async function steamNetJoinLobby(lobbyId: string): Promise<void> {
  if (!IS_DESKTOP) return
  try { await invokeSteam<void>('steam_net_join_lobby', { lobbyId }) } catch { /* ignore */ }
}

/** Leave the current lobby and clear the joinable Rich Presence. */
export async function steamNetLeaveLobby(): Promise<void> {
  if (!IS_DESKTOP) return
  try { await invokeSteam<void>('steam_net_leave_lobby') } catch { /* ignore */ }
}

/** Current lobby members' SteamID64 (JS filters out self). Empty off-desktop / no lobby. */
export async function steamNetMembers(): Promise<string[]> {
  if (!IS_DESKTOP) return []
  try { return await invokeSteam<string[]>('steam_net_members') }
  catch { return [] }
}

/** Send a reliable message (string payload) to a peer by SteamID64. */
export async function steamNetSend(to: string, data: string): Promise<boolean> {
  if (!IS_DESKTOP) return false
  try { return await invokeSteam<boolean>('steam_net_send', { to, data }) }
  catch { return false }
}

/** Open the Steam overlay invite dialog for the current lobby. */
export async function steamNetInvite(): Promise<void> {
  if (!IS_DESKTOP) return
  try { await invokeSteam<void>('steam_net_invite') } catch { /* ignore */ }
}

/** Subscribe to the "steam-net" event stream. Returns an unsubscribe fn (no-op off-desktop). */
export async function onSteamNetEvent(cb: (e: SteamNetEvent) => void): Promise<() => void> {
  if (!IS_DESKTOP) return () => {}
  try {
    const { listen } = await import('@tauri-apps/api/event')
    return await listen<SteamNetEvent>('steam-net', e => cb(e.payload))
  } catch { return () => {} }
}
