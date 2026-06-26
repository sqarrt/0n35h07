import type { CSSProperties } from 'react'
import { glassCard } from './glass'

// Fixed-size liquid-glass panel in the top-left corner showing the full current Strudel program (scrolls if long).
// DOM (not in-scene) so the whole code is guaranteed on-screen; a soft CSS glow keeps it in the takeover's style.
const panel: CSSProperties = {
  position: 'fixed', top: 18, left: 18, zIndex: 110, pointerEvents: 'none',   // display-only — never blocks player clicks
  ...glassCard,
  width: '20vw', maxHeight: '70vh', padding: '12px 16px',
  overflow: 'auto',
  fontFamily: 'ui-monospace, "Share Tech Mono", monospace',
  fontSize: '0.72rem', lineHeight: 1.5, letterSpacing: '0.02em',
  color: '#bcd2ff', textShadow: '0 0 6px rgba(120,170,255,0.45)',
  // Wrap long lines so the whole program stays inside the fixed-width panel (no horizontal overflow).
  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflowX: 'hidden', tabSize: 2,
}

/** The current Strudel code, in a fixed top-left glass panel (desktop radio screen). */
export function RadioCodePanel({ code }: { code: string }) {
  return <div style={panel} data-testid="radio-code">{code || '—'}</div>
}
