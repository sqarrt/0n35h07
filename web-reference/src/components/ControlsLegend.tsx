import type { CSSProperties } from 'react'
import { useT } from '../i18n'

interface Bind { keys: string[]; action: string }

const chip: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  minWidth: 22, height: 22, padding: '0 6px',
  border: '1px solid #4af', borderRadius: 4,
  background: 'rgba(68,170,255,0.08)', color: '#bdf',
  fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1,
}

const item: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.45rem' }

/** Controls grid: key chip(s) + action. No positioning — the wrapper is provided by the call site. */
export function ControlsLegend() {
  const t = useT()
  // Keys with letter names (W/A/S/D, Space…) are universal and not translated;
  // only action labels and mouse buttons are translated.
  const CONTROLS: Bind[] = [
    { keys: ['W', 'A', 'S', 'D'], action: t.ctrlMove },
    { keys: ['Space'], action: t.ctrlJump },
    { keys: ['Shift'], action: t.ctrlDash },
    { keys: [t.keyLmb], action: t.ctrlFire },
    { keys: [t.keyRmb], action: t.ctrlShield },
    { keys: [t.keyMouse], action: t.ctrlLook },
    { keys: ['V'], action: t.ctrlView },
    { keys: ['Esc'], action: t.ctrlPause },
  ]
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem 1.2rem', justifyContent: 'center' }}>
      {CONTROLS.map(({ keys, action }) => (
        <div key={action} style={item}>
          <span style={{ display: 'flex', gap: 3 }}>
            {keys.map(k => <span key={k} style={chip}>{k}</span>)}
          </span>
          <span style={{ color: '#889', fontFamily: 'monospace', fontSize: '0.72rem', letterSpacing: '0.05em' }}>
            {action}
          </span>
        </div>
      ))}
    </div>
  )
}
