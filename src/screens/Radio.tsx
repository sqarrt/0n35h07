import type { CSSProperties } from 'react'
import { Button } from '../ui/Button'
import { Slider } from '../ui/Slider'
import { glassCard } from '../components/glass'
import { radioTrackName } from '../radio/trackName'
import type { RadioInitState } from '../radio/warmup'
import type { MusicalState } from '../radio/music/radio/MusicalState'

// Non-localized brand feature (see design spec) — literal labels, monospace UI font.

interface RadioProps {
  initState: RadioInitState
  enabled: boolean
  state: MusicalState | null
  volume: number                 // profile.volumeRadio (0..1)
  onToggle: () => void           // start/stop radio (the gesture)
  onVolume: (v: number) => void
  onBack: () => void
}

const card: CSSProperties = {
  ...glassCard,
  width: '100%', maxWidth: 480,
  padding: '2.4rem 2.2rem',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '1.1rem',
  fontFamily: 'var(--ui-font)', color: '#cdd', textAlign: 'center',
}
const sectionLabel: CSSProperties = { color: 'var(--accent)', fontSize: '0.8rem', letterSpacing: '0.28em' }
const trackStyle: CSSProperties = { fontSize: '1.5rem', letterSpacing: '0.06em', color: '#eef', wordBreak: 'break-all' }
const infoStyle: CSSProperties = { color: 'var(--accent-dim)', fontSize: '0.85rem', letterSpacing: '0.12em', lineHeight: 1.8 }
const statusStyle: CSSProperties = { color: 'var(--accent-dim)', fontSize: '0.8rem', letterSpacing: '0.12em', minHeight: '1.1rem' }

/** Full-screen Radio player (centred glass card; the MenuBackdrop plays behind, like other screens). */
export function Radio({ initState, enabled, state, volume, onToggle, onVolume, onBack }: RadioProps) {
  const ready = initState === 'ready'
  const trackName = state ? radioTrackName(state) : '—'
  const status =
    initState === 'error' ? 'error — check connection'
    : initState !== 'ready' ? 'initializing…'
    : enabled ? '' : 'stopped'

  return (
    <div className="panel-fill" style={{ alignItems: 'center', justifyContent: 'center' }}>
      <div style={card} data-testid="radio-screen">
        <div style={sectionLabel}>RADIO</div>

        <div style={trackStyle} data-testid="radio-track-name">{trackName}</div>

        <div style={infoStyle}>
          {state ? <>{state.bpm} BPM&nbsp;&nbsp;·&nbsp;&nbsp;{state.key} {state.scaleName}</> : <>&nbsp;</>}<br />
          {state ? <>section: {state.section}&nbsp;&nbsp;·&nbsp;&nbsp;bar {state.bar}</> : <>&nbsp;</>}
        </div>

        <Button
          variant="primary"
          disabled={!ready}
          onClick={onToggle}
          data-testid="radio-toggle"
          style={{ minWidth: '10rem' }}
        >
          {!ready ? '···' : enabled ? '■ STOP' : '▶ START'}
        </Button>

        <div style={statusStyle}>{status}</div>

        <div style={{ opacity: ready ? 1 : 0.4, pointerEvents: ready ? 'auto' : 'none' }}>
          <Slider label="RADIO VOLUME" value={volume} onChange={onVolume} />
        </div>

        <Button variant="ghost" onClick={onBack} data-testid="radio-back" style={{ marginTop: '0.4rem' }}>← BACK</Button>
      </div>
    </div>
  )
}
