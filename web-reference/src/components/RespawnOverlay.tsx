import { HUD_FRAME_INSET } from '../constants'
import { useT } from '../i18n'

const GHOST = '#9cf'

/**
 * Horizontal bar of remaining phase time (top/bottom), shrinking toward the center.
 * Sits on the HUD perimeter line (like the shield bracket arms and dash bars) → one contour.
 * Full length = half the screen width, centered.
 */
function Bar({ edge, pct }: { edge: 'top' | 'bottom'; pct: number }) {
  return (
    <div style={{
      position: 'fixed', left: '50%', transform: 'translateX(-50%)',
      top:    edge === 'top'    ? HUD_FRAME_INSET : undefined,
      bottom: edge === 'bottom' ? HUD_FRAME_INSET : undefined,
      height: 6, width: `${pct * 0.5}%`,
      background: GHOST, boxShadow: `0 0 10px ${GHOST}`,
      transition: 'width 0.05s linear', pointerEvents: 'none', zIndex: 14,
    }} />
  )
}

/**
 * First-person ghost phase indicator: edge tint + speed-lines (radial gradient),
 * with remaining time shown as bars at the top and bottom of the HUD. `progress` 1→0.
 */
export function RespawnOverlay({ progress }: { progress: number }) {
  const t = useT()
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
        position: 'fixed', top: '50%', left: 0, right: 0, textAlign: 'center',
        transform: 'translateY(-120px)',   // above the crosshair, below the timer/score (MatchHud on top)
        color: GHOST, fontFamily: 'var(--ui-font)', fontSize: '0.75rem', letterSpacing: '0.25em',
        textShadow: `0 0 8px ${GHOST}`, pointerEvents: 'none', zIndex: 14,
      }}>
        {t.respawning}
      </div>
    </>
  )
}
