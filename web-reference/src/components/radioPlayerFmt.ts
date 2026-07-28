// Pure formatting/geometry helpers for the radio player. Split out of RadioPlayer.tsx so that component file only
// exports a component (react-refresh/only-export-components) — these are shared by the component and its unit tests.
const SEC_PER_MIN = 60
const MS_PER_SEC = 1000

/** Pointer X → fraction 0..1 along a rail rect. Guards a zero-width rail. */
export function fractionFromPointer(clientX: number, rect: { left: number; width: number }): number {
  if (rect.width <= 0) return 0
  return Math.max(0, Math.min(1, (clientX - rect.left) / rect.width))
}

/** Milliseconds → "m:ss" (negative/NaN → "0:00"). */
export function fmtMs(ms: number): string {
  if (!(ms > 0)) return '0:00'
  const total = Math.floor(ms / MS_PER_SEC)
  const m = Math.floor(total / SEC_PER_MIN)
  const s = total % SEC_PER_MIN
  return `${m}:${s < 10 ? '0' : ''}${s}`
}
