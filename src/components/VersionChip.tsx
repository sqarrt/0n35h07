/**
 * Game version (from package.json via Vite define) — quiet chip in the bottom-right
 * corner of pre-game screens, mirroring NetStatusChip (which sits on the left).
 * On desktop it doubles as an "open log folder" button (reveals the diagnostic session logs).
 */
import { IS_DESKTOP } from '../platform'
import { gameLog } from '../diag/gameLog'

export function VersionChip() {
  if (IS_DESKTOP) {
    return (
      <button className="version-chip version-chip--btn" onClick={() => { void gameLog.revealDir() }}>
        v{__APP_VERSION__}
      </button>
    )
  }
  return <div className="version-chip">v{__APP_VERSION__}</div>
}
