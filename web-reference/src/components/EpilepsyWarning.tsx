import { useState, useEffect } from 'react'
import { useT } from '../i18n'

// Fade-out duration on close (in sync with the transition in .warn-screen). We unmount once it elapses.
const WARN_FADE_MS = 280
// How long after showing the hint appears and closing is unlocked.
// During this time everything heavy warms up behind the overlay (Trystero ~860ms + sphere glow outline).
const HINT_DELAY_MS = 1500

/**
 * Fullscreen flicker/flash warning (photosensitive epilepsy). Shown ONCE on launch, from the first render
 * (covers the menu-canvas warmup so the menu doesn't flash). No heavy work runs under it (deferred in App
 * until the canvas is ready) → WebGL context init behind the overlay goes through cleanly. Closed with a
 * left click, but only after HINT_DELAY_MS (everything warms up during that time). No heavy CSS filters
 * (only opacity/animations on the compositor).
 */
export function EpilepsyWarning({ onDismiss }: { onDismiss: () => void }) {
  const t = useT()
  const [ready, setReady] = useState(false)   // has HINT_DELAY_MS elapsed → can close
  const [out, setOut] = useState(false)
  useEffect(() => {
    const timer = setTimeout(() => setReady(true), HINT_DELAY_MS)
    return () => clearTimeout(timer)
  }, [])

  const handleDismiss = () => {
    if (!ready || out) return   // before the hint we ignore clicks (waiting for warmup)
    setOut(true)
    setTimeout(onDismiss, WARN_FADE_MS)
  }

  return (
    <div
      className={`warn-screen${out ? ' warn-screen--out' : ''}${ready ? ' warn-screen--ready' : ''}`}
      role="dialog" aria-modal="true" onClick={handleDismiss}
    >
      {/* Ringed planet (the game's identity) — quietly "breathes" in the background, no blur. */}
      <svg className="warn-planet" width="560" height="560" viewBox="0 0 256 256" aria-hidden="true">
        <defs>
          <radialGradient id="warnSphere" cx="37%" cy="31%" r="76%">
            <stop offset="0%" stopColor="#e8f7ff" />
            <stop offset="28%" stopColor="#73c9ff" />
            <stop offset="70%" stopColor="#2a8fe0" />
            <stop offset="100%" stopColor="#093c6f" />
          </radialGradient>
        </defs>
        <g transform="rotate(-20 128 128)">
          <path d="M40 128 A88 29 0 0 1 216 128" fill="none" stroke="#1c66a4" strokeWidth="9" strokeLinecap="round" />
        </g>
        <circle cx="128" cy="128" r="60" fill="url(#warnSphere)" />
        <ellipse cx="108" cy="104" rx="19" ry="12" fill="#fff" opacity="0.45" />
        <g transform="rotate(-20 128 128)">
          <path d="M216 128 A88 29 0 0 1 40 128" fill="none" stroke="#a6e3ff" strokeWidth="10" strokeLinecap="round" />
        </g>
      </svg>

      <div className="warn-content">
        <div className="warn-box">
          <div className="warn-head"><span className="warn-icon">⚠</span> {t.warnTitle}</div>
          <div className="warn-text">{t.warnBody}</div>
        </div>
        {/* The hint appears after HINT_DELAY_MS. Space for it is reserved (opacity, not mount) → no jumping. */}
        <div className={`warn-hint${ready ? ' warn-hint--show' : ''}`}>
          <span className="warn-chip">{t.warnContinueKey}</span>
          <span>{t.warnContinueHint}</span>
        </div>
      </div>
    </div>
  )
}
