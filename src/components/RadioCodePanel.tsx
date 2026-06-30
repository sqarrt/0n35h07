import { useState, type CSSProperties } from 'react'
import { glassCard } from './glass'

// Full-height liquid-glass panel down the left edge showing the full current Strudel program (scrolls when long).
// DOM (not in-scene) so the whole code is guaranteed on-screen; a soft CSS glow keeps it in the takeover's style.
// The frame is click-through (pointer-events:none) so the margins never block the player; the SCROLLABLE code box
// re-enables pointer events (auto) so the wheel/drag actually scroll it — AND a click anywhere on it copies the code.
const panel: CSSProperties = {
  position: 'fixed', top: 18, left: 18, bottom: 18, zIndex: 110, pointerEvents: 'none',
  ...glassCard,
  width: '20vw', padding: 0, overflow: 'hidden',
  display: 'flex', flexDirection: 'column',
}
// The whole code box is the copy affordance now (no separate button). cursor:pointer + the .radio-code-box CSS
// (hover/active/copied) give the click feedback; flashing is a box-shadow/background tint, so it never reflows.
const codeBox: CSSProperties = {
  flex: 1, minHeight: 0, overflow: 'auto', pointerEvents: 'auto', padding: '12px 16px',
  fontFamily: 'ui-monospace, "Share Tech Mono", monospace',
  fontSize: '0.72rem', lineHeight: 1.5, letterSpacing: '0.02em',
  color: '#bcd2ff', textShadow: '0 0 6px rgba(120,170,255,0.45)',
  // Wrap long lines so the whole program stays inside the fixed-width panel (no horizontal overflow).
  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflowX: 'hidden', tabSize: 2,
  cursor: 'pointer',
}

const COPIED_MS = 1200

/** The current Strudel code, in a fixed top-left glass panel (desktop radio screen). Click anywhere on it to copy. */
export function RadioCodePanel({ code }: { code: string }) {
  const [copied, setCopied] = useState(false)
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), COPIED_MS)
    }).catch(() => {})
  }
  return (
    <div style={panel} data-testid="radio-code">
      <div
        className={`radio-code-box${copied ? ' is-copied' : ''}`}
        style={codeBox}
        onClick={copy}
        aria-label="copy code"
        data-testid="radio-code-copy"
      >{code || '—'}</div>
    </div>
  )
}
