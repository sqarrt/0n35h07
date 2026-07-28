import { IS_DESKTOP } from '../platform'
import { gameLog } from './gameLog'

/** Forward Rust-side Steam-transport diagnostics (the 'diag' event) into the session log. Desktop-only. */
export async function installSteamDiagBridge(): Promise<void> {
  if (!IS_DESKTOP) return
  try {
    const { listen } = await import('@tauri-apps/api/event')
    await listen<string>('diag', e => gameLog.log('steam', 'raw', { line: e.payload }))
  } catch { /* not under Tauri / event API missing */ }
}
