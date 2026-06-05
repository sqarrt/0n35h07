import { Fragment } from 'react'
import type { CSSProperties } from 'react'
import type { MatchResult } from '../hooks/useGameHUD'
import { Button } from '../ui/Button'

const OUTCOME: Record<MatchResult['outcome'], { label: string; color: string }> = {
  win:  { label: 'ПОБЕДА',    color: 'var(--ok)' },
  lose: { label: 'ПОРАЖЕНИЕ', color: 'var(--danger)' },
  draw: { label: 'НИЧЬЯ',     color: '#fd4' },
}
const REASON: Record<MatchResult['reason'], string> = {
  time: 'ВРЕМЯ ВЫШЛО',
  disconnect: 'СОПЕРНИК ОТКЛЮЧИЛСЯ',
}

const FADE = '@keyframes matchEndFade { from { opacity: 0 } to { opacity: 1 } }'

const wrap: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(7,10,14,0.9)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
  fontFamily: 'var(--ui-font)', color: 'var(--text)',
  animation: 'matchEndFade 0.1s ease-out',   // короткое появление после стоп-кадра конца матча
}

/** Экран конца матча: исход + причина + финальный счёт + ВЫЙТИ. */
export function MatchEndedOverlay({ result, onExit }: { result: MatchResult; onExit: () => void }) {
  const o = OUTCOME[result.outcome]
  return (
    <div style={wrap}>
      <style>{FADE}</style>
      <h1 style={{ fontSize: 52, letterSpacing: '0.22em', margin: '0 0 4px', marginLeft: '0.22em', color: o.color, textShadow: `0 0 26px ${o.color}` }}>
        {o.label}
      </h1>
      <div style={{ fontSize: 12, letterSpacing: '0.2em', color: '#7a8694', marginBottom: 28 }}>{REASON[result.reason]}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) 2rem 2rem', gap: '0.35rem 1.4rem', marginBottom: 28 }}>
        <div style={{ color: 'var(--accent)', letterSpacing: '0.15em' }}>ИГРОК</div>
        <div style={{ color: 'var(--accent)', textAlign: 'right' }}>K</div>
        <div style={{ color: 'var(--accent)', textAlign: 'right' }}>D</div>
        {result.scores.map((s, i) => (
          <Fragment key={i}>
            <div>{s.name}</div>
            <div style={{ textAlign: 'right' }}>{s.kills}</div>
            <div style={{ textAlign: 'right' }}>{s.deaths}</div>
          </Fragment>
        ))}
      </div>
      <Button variant="primary" onClick={onExit}>ВЫЙТИ</Button>
    </div>
  )
}
