import type { CSSProperties } from 'react'
import { glassCard } from './glass'
import type { RadioInitState } from '../radio/warmup'

// "Radio" is a non-localized brand feature (track names are hardware-index style, no localisation —
// see the design spec), so the widget labels are literal, matching the menu's monospace UI font.

interface RadioMiniPlayerProps {
  initState: RadioInitState
  enabled: boolean
  trackName: string | null
  onToggle: () => void   // flip radioEnabled (the toggle IS the audio user-gesture)
  onOpen: () => void     // open the full Radio screen
}

// Anchored bottom-right above the VersionChip; grows leftward so it never shifts other UI.
const wrap: CSSProperties = {
  position: 'fixed', right: 16, bottom: 52, zIndex: 50,
  ...glassCard,
  padding: '7px 12px',
  display: 'flex', alignItems: 'center', gap: 10,
  fontFamily: 'var(--ui-font)', fontSize: '0.78rem', letterSpacing: '0.14em',
  color: '#cdd', userSelect: 'none',
}

const toggleBtn = (enabled: boolean): CSSProperties => ({
  appearance: 'none', background: 'transparent', cursor: 'pointer',
  border: 'none', padding: 0, font: 'inherit', letterSpacing: 'inherit',
  color: enabled ? 'var(--accent)' : '#cdd',
})

const nameBtn: CSSProperties = {
  appearance: 'none', background: 'transparent', cursor: 'pointer',
  border: 'none', borderLeft: '1px solid rgba(255,255,255,0.14)', paddingLeft: 10,
  font: 'inherit', letterSpacing: '0.08em', color: 'var(--accent-dim)',
  maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
}

/** Persistent corner widget shown on all menu screens (hidden on the Radio screen itself). */
export function RadioMiniPlayer({ initState, enabled, trackName, onToggle, onOpen }: RadioMiniPlayerProps) {
  if (initState === 'idle' || initState === 'loading')
    return <div style={{ ...wrap, opacity: 0.5 }} data-testid="radio-mini">RADIO&nbsp;<span style={{ opacity: 0.7 }}>···</span></div>

  if (initState === 'error')
    return <div style={{ ...wrap, opacity: 0.5 }} data-testid="radio-mini" title="radio unavailable — check connection">RADIO&nbsp;✕</div>

  return (
    <div style={wrap} data-testid="radio-mini">
      <button style={toggleBtn(enabled)} onClick={onToggle} data-testid="radio-mini-toggle" aria-pressed={enabled}>
        {enabled ? '■' : '▶'}&nbsp;RADIO
      </button>
      {enabled && trackName && (
        <button style={nameBtn} onClick={onOpen} data-testid="radio-mini-open" title={trackName}>{trackName}</button>
      )}
    </div>
  )
}
