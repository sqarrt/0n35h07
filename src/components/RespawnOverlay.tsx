const GHOST = '#9cf'

/** Горизонтальная полоса остатка времени фазы (сверху/снизу), тает к центру — как откат дэша. */
function Bar({ edge, pct }: { edge: 'top' | 'bottom'; pct: number }) {
  return (
    <div style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      top:    edge === 'top'    ? 0 : undefined,
      bottom: edge === 'bottom' ? 0 : undefined,
      height: 5, width: `${pct}%`,
      background: GHOST, boxShadow: `0 0 10px ${GHOST}`,
      transition: 'width 0.05s linear', pointerEvents: 'none', zIndex: 14,
    }} />
  )
}

/**
 * Индикация фазы призрака от первого лица: тинт по краям + speed-lines (радиальный градиент),
 * а остаток времени — полосы сверху и снизу HUD. `progress` 1→0.
 */
export function RespawnOverlay({ progress }: { progress: number }) {
  const pct = Math.min(1, Math.max(0, progress)) * 100
  return (
    <>
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 13,
        boxShadow: 'inset 0 0 160px rgba(120,180,255,0.45)',
        background: 'radial-gradient(ellipse at center, transparent 52%, rgba(150,200,255,0.14) 100%)',
      }} />
      <Bar edge="top" pct={pct} />
      <Bar edge="bottom" pct={pct} />
      <div style={{
        position: 'fixed', top: 16, left: 0, right: 0, textAlign: 'center',
        color: GHOST, fontFamily: 'monospace', fontSize: '0.75rem', letterSpacing: '0.25em',
        textShadow: `0 0 8px ${GHOST}`, pointerEvents: 'none', zIndex: 14,
      }}>
        ВОЗРОЖДЕНИЕ
      </div>
    </>
  )
}
