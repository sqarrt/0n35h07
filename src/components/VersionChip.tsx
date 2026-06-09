/**
 * Версия игры (из package.json через Vite define) — тихий чип в правом нижнем углу
 * пред-игровых экранов, зеркально NetStatusChip (тот в левом).
 */
export function VersionChip() {
  return <div className="version-chip">v{__APP_VERSION__}</div>
}
