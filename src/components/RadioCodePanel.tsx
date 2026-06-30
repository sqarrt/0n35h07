import { useState, type CSSProperties } from 'react'
import { glassCard } from './glass'

// Full-height liquid-glass panel down the left edge showing the full current Strudel program (scrolls when long).
// DOM (not in-scene) so the whole code is guaranteed on-screen; a soft CSS glow keeps it in the takeover's style.
// The frame is click-through (pointer-events:none) so the margins never block the player; the SCROLLABLE code box
// re-enables pointer events (auto) so the wheel/drag actually scroll it.
const panel: CSSProperties = {
  position: 'fixed', top: 18, left: 18, bottom: 18, zIndex: 110, pointerEvents: 'none',
  ...glassCard,
  width: '20vw', padding: 0, overflow: 'hidden',
  display: 'flex', flexDirection: 'column',
}
const codeBox: CSSProperties = {
  flex: 1, minHeight: 0, overflow: 'auto', pointerEvents: 'auto', padding: '12px 16px',
  fontFamily: 'ui-monospace, "Share Tech Mono", monospace',
  fontSize: '0.72rem', lineHeight: 1.5, letterSpacing: '0.02em',
  color: '#bcd2ff', textShadow: '0 0 6px rgba(120,170,255,0.45)',
  // Wrap long lines so the whole program stays inside the fixed-width panel (no horizontal overflow).
  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflowX: 'hidden', tabSize: 2,
}
const copyBtn = (copied: boolean): CSSProperties => ({
  position: 'absolute', top: 8, right: 8, zIndex: 1, pointerEvents: 'auto',
  appearance: 'none', cursor: 'pointer', borderRadius: 8,
  border: `1px solid ${copied ? 'var(--accent)' : 'rgba(255,255,255,0.18)'}`,
  background: 'rgba(14,20,38,0.72)', color: copied ? 'var(--accent)' : '#bcd2ff',
  width: 30, height: 28, display: 'grid', placeItems: 'center', fontSize: '0.86rem', lineHeight: 1, padding: 0,
})

const COPIED_MS = 1200

/** The current Strudel code, in a fixed top-left glass panel (desktop radio screen), with a copy button. */
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
      <button className="radio-code-copy" style={copyBtn(copied)} onClick={copy} aria-label="copy code" title="copy" data-testid="radio-code-copy">
        {copied ? '✓' : '⧉'}
      </button>
      <div style={codeBox}>{code || '—'}</div>
    </div>
  )
}
