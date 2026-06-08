import type { CSSProperties } from 'react'

const PERCENT_MAX = 100   // range-инпут работает в целых 0..100, значение наружу — доля 0..1

interface SliderProps {
  label: string
  value: number                    // 0..1
  onChange: (v: number) => void    // 0..1
  'aria-label'?: string
}

const labelStyle: CSSProperties = { color: '#556', fontSize: '0.7rem', letterSpacing: '0.15em' }
// Ширина значения зафиксирована (4ch) → подпись «100%»/«5%» не сдвигает раскладку при кручении.
const valueStyle: CSSProperties = { color: 'var(--accent-dim)', fontSize: '0.75rem', width: '4ch', textAlign: 'right', flex: '0 0 auto' }

/** Ползунок громкости 0..1 с подписью и процентом. Раскладка не «прыгает» (ширина % фиксирована). */
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
