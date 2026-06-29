/**
 * Game version (from package.json via Vite define) — quiet chip in the bottom-right
 * corner of pre-game screens, mirroring NetStatusChip (which sits on the left).
 * On desktop it doubles as an "open log folder" button (reveals the diagnostic session logs).
 */
import { useT } from '../i18n'
import { IS_DESKTOP } from '../platform'
import { gameLog } from '../diag/gameLog'

/** Desktop variant: clickable chip that reveals the log folder. Split out so the i18n hook runs ONLY on desktop. */
function RevealLogsChip() {
  const t = useT()
  return (
    <button className="version-chip version-chip--btn" title={t.revealLogs} onClick={() => { void gameLog.revealDir() }}>
      v{__APP_VERSION__}
    </button>
  )
}

export function VersionChip() {
  return IS_DESKTOP ? <RevealLogsChip /> : <div className="version-chip">v{__APP_VERSION__}</div>
}
