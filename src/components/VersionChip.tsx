/**
 * Game version (from package.json via Vite define) — quiet chip in the bottom-right
 * corner of pre-game screens, mirroring NetStatusChip (which sits on the left).
 */
export function VersionChip() {
  return <div className="version-chip">v{__APP_VERSION__}</div>
}
