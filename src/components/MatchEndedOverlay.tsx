import { useState, useEffect, Fragment } from 'react'
import type { PlayerScore } from '../hooks/useGameHUD'
import { MATCH_ENDED_REVEAL_MS } from '../constants'
import { btn, screenOverlay } from '../screens/styles'

interface MatchEndedOverlayProps {
  name: string
  scores: PlayerScore[]
  onExit: () => void
}

/** Конец матча: баннер «{name} отключился», через паузу — финальный скорборд + ВЫЙТИ. */
export function MatchEndedOverlay({ name, scores, onExit }: MatchEndedOverlayProps) {
  const [revealed, setRevealed] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), MATCH_ENDED_REVEAL_MS)
    return () => clearTimeout(t)
  }, [])

  return (
    <div style={{ ...screenOverlay, background: 'rgba(10,10,15,0.88)', zIndex: 30 }}>
      <h2 style={{ color: '#f66', letterSpacing: '0.15em', marginTop: 0, marginBottom: revealed ? '1.5rem' : 0 }}>
        {name} отключился
      </h2>

      {revealed && (
        <>
          <div style={{
            display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) 2rem 2rem', gap: '0.35rem 1.4rem',
            fontFamily: 'monospace', color: '#cde', marginBottom: '2rem',
          }}>
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
          <button style={btn} onClick={onExit}>ВЫЙТИ</button>
        </>
      )}
    </div>
  )
}
