import type { CSSProperties } from 'react'

const PERCENT_MAX = 100   // range input works in integers 0..100, the value out is a fraction 0..1

interface SliderProps {
  label: string
  value: number                    // 0..1
  onChange: (v: number) => void    // 0..1
  'aria-label'?: string
}

const labelStyle: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em' }
// Value width is fixed (4ch) → the "100%"/"5%" label does not shift the layout while dragging.
const valueStyle: CSSProperties = { color: 'var(--accent-dim)', fontSize: '0.75rem', width: '4ch', textAlign: 'right', flex: '0 0 auto' }

/** Volume slider 0..1 with a label and percentage. Layout does not "jump" (% width is fixed). */
export function Slider({ label, value, onChange, 'aria-label': ariaLabel }: SliderProps) {
  const percent = Math.round(value * PERCENT_MAX)
  return (
    <div style={{ marginBottom: '1.4rem' }}>
      <div style={{ ...labelStyle, marginBottom: '0.5rem' }}>{label}</div>
      <div style={{ display: 'flex', alignItems: 'center', gap: '0.8rem', width: '18rem' }}>
        <input
          className="slider"
          type="range"
          min={0}
          max={PERCENT_MAX}
          step={1}
          value={percent}
          aria-label={ariaLabel ?? label}
          onChange={e => onChange(Number(e.target.value) / PERCENT_MAX)}
        />
        <span style={valueStyle}>{percent}%</span>
      </div>
    </div>
  )
}
