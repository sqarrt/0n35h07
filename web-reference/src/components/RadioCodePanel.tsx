import { useState, type CSSProperties } from 'react'
import { useT } from '../i18n'
import { useWindowChrome } from './useWindowChrome'
import './RadioExplorer.css' // reuse the window-chrome look: .rexp (glass frame) / .rexp-title / .rexp-wbtn / .rexp-resize

// The current Strudel program in a floating glass WINDOW (desktop radio): draggable, resizable, maximizable — same
// chrome as the library explorer (via useWindowChrome). Minimizing is owned by App (a bar over the player, next to
// the LIBRARY bar); when minimized this renders nothing. Click the code to copy it.
const CODE_MIN = { w: 220, h: 160 }
const COPIED_MS = 1200

const codeBox: CSSProperties = {
  flex: 1, minHeight: 0, overflow: 'auto', padding: '12px 16px',
  fontFamily: 'ui-monospace, "Share Tech Mono", monospace',
  fontSize: '0.72rem', lineHeight: 1.5, letterSpacing: '0.02em',
  color: '#bcd2ff', textShadow: '0 0 6px rgba(120,170,255,0.45)',
  // Wrap long lines so the whole program stays inside the panel (no horizontal overflow).
  whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', overflowX: 'hidden', tabSize: 2,
  cursor: 'pointer', position: 'relative', zIndex: 1,
}

interface RadioCodePanelProps { code: string; minimized: boolean; onMinimize: () => void }

/** The current Strudel code as a floating, windowed glass panel (desktop radio screen). Click the code to copy. */
export function RadioCodePanel({ code, minimized, onMinimize }: RadioCodePanelProps) {
  const t = useT()
  const [copied, setCopied] = useState(false)
  const chrome = useWindowChrome(
    { x: 18, y: 18, w: Math.round(Math.min(440, window.innerWidth * 0.2)), h: Math.max(240, window.innerHeight - 100) },
    CODE_MIN,
  )
  const copy = () => {
    navigator.clipboard?.writeText(code).then(() => {
      setCopied(true)
      window.setTimeout(() => setCopied(false), COPIED_MS)
    }).catch(() => {})
  }

  if (minimized) return null // the "PROGRAM" bar over the player (RadioPlayer) restores it

  return (
    <div className={`rexp${chrome.live ? '' : ' anim'}`} data-testid="radio-code" style={{ zIndex: 170, ...chrome.frameStyle }}>
      <div className="rexp-title" onMouseDown={(e) => { if (!chrome.maxed && !(e.target as HTMLElement).closest('.rexp-wbtn')) chrome.startGeo(e, 'move') }}>
        <b>{t.radioProgram}{copied ? ` (${t.radioCopied})` : ''}</b><span style={{ flex: 1 }} />
        <span className="rexp-wbtn" onClick={onMinimize}>_</span>
        <span className="rexp-wbtn" onClick={chrome.toggleMax}>▢</span>
        <span className="rexp-wbtn x" onClick={onMinimize}>✕</span>
      </div>
      <div
        className={`radio-code-box${copied ? ' is-copied' : ''}`}
        style={codeBox}
        onClick={copy}
        aria-label="copy code"
        data-testid="radio-code-copy"
      >{code || '—'}</div>
      {!chrome.maxed && <div className="rexp-resize" onMouseDown={(e) => chrome.startGeo(e, 'resize')} />}
    </div>
  )
}
