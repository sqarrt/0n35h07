import { Fragment } from 'react'
import type { PlayerScore } from '../hooks/useGameHUD'

/** Таблица K/D (как Tab в CS): показывается, пока зажат Tab. */
export function Scoreboard({ scores, visible }: { scores: PlayerScore[]; visible: boolean }) {
  if (!visible) return null
  return (
    <div style={{
      position: 'fixed', top: '18%', left: '50%', transform: 'translateX(-50%)',
      zIndex: 20, pointerEvents: 'none',
      background: 'rgba(10,10,15,0.9)', border: '1px solid #234',
      padding: '0.9rem 1.4rem', fontFamily: 'monospace', color: '#cde',
    }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) 2rem 2rem', gap: '0.35rem 1.4rem' }}>
        <div style={{ color: '#4af', letterSpacing: '0.15em' }}>ИГРОК</div>
        <div style={{ color: '#4af', textAlign: 'right' }}>K</div>
        <div style={{ color: '#4af', textAlign: 'right' }}>D</div>
        {scores.map((s, i) => (
          <Fragment key={i}>
            <div>{s.name}</div>
            <div style={{ textAlign: 'right' }}>{s.kills}</div>
            <div style={{ textAlign: 'right' }}>{s.deaths}</div>
          </Fragment>
        ))}
      </div>
    </div>
  )
}
