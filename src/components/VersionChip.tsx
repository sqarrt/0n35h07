/**
 * Game version (from package.json via Vite define) — quiet chip in the bottom-right
 * corner of pre-game screens, mirroring NetStatusChip (which sits on the left).
 * On desktop it doubles as an "open log folder" button (reveals the diagnostic session logs).
 */
import { useT } from '../i18n'
import { IS_DESKTOP } from '../platform'
import { gameLog } from '../diag/gameLog'

export function VersionChip() {
  const t = useT()
  if (!IS_DESKTOP) return <div className="version-chip">v{__APP_VERSION__}</div>
  return (
    <button className="version-chip version-chip--btn" title={t.revealLogs} onClick={() => { void gameLog.revealDir() }}>
      v{__APP_VERSION__}
    </button>
  )
}
