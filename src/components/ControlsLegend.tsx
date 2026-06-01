import type { CSSProperties } from 'react'

interface Bind { keys: string[]; action: string }

const CONTROLS: Bind[] = [
  { keys: ['W', 'A', 'S', 'D'], action: 'Движение' },
  { keys: ['Space'], action: 'Прыжок' },
  { keys: ['Shift'], action: 'Рывок' },
  { keys: ['ЛКМ'], action: 'Выстрел' },
  { keys: ['ПКМ'], action: 'Щит' },
  { keys: ['Мышь'], action: 'Обзор' },
  { keys: ['V'], action: 'Вид 1/3' },
  { keys: ['Tab'], action: 'Счёт' },
  { keys: ['Esc'], action: 'Пауза' },
]

const chip: CSSProperties = {
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
  minWidth: 22, height: 22, padding: '0 6px',
  border: '1px solid #4af', borderRadius: 4,
  background: 'rgba(68,170,255,0.08)', color: '#bdf',
  fontFamily: 'monospace', fontSize: '0.72rem', lineHeight: 1,
}

const item: CSSProperties = { display: 'flex', alignItems: 'center', gap: '0.45rem' }

/** Сетка управления: клавиша-чип(ы) + действие. Без позиционирования — обёртку даёт место использования. */
export function ControlsLegend() {
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
