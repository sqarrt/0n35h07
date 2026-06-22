import { IS_DESKTOP } from '../platform'

export interface SteamUser { id: string; name: string }

// Tauri's invoke is imported lazily and ONLY on desktop, so the browser bundle never
// pulls it in and the unit tests never touch it.
async function invokeSteam<T>(cmd: string): Promise<T> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd)
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
