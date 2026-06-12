import { Fragment } from 'react'
import type { CSSProperties } from 'react'
import type { MatchResult } from '../hooks/useGameHUD'
import { Button } from '../ui/Button'
import { useT } from '../i18n'

// Цвет исхода — семантика, а не текст; подпись берётся из словаря по ключу исхода.
const OUTCOME_COLOR: Record<MatchResult['outcome'], string> = {
  win:  'var(--ok)',
  lose: 'var(--danger)',
  draw: '#fd4',
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
  const t = useT()
  const color = OUTCOME_COLOR[result.outcome]
  const outcomeLabel: Record<MatchResult['outcome'], string> = {
    win: t.matchOutcomeWin, lose: t.matchOutcomeLose, draw: t.matchOutcomeDraw,
  }
  const reasonLabel: Record<MatchResult['reason'], string> = {
    time: t.matchReasonTime, disconnect: t.matchReasonDisconnect,
  }
  return (
    <div style={wrap}>
      <style>{FADE}</style>
      <h1 data-testid="match-outcome" style={{ fontSize: 52, letterSpacing: '0.22em', margin: '0 0 4px', marginLeft: '0.22em', color, textShadow: `0 0 26px ${color}` }}>
        {outcomeLabel[result.outcome]}
      </h1>
      <div data-testid="match-reason" style={{ fontSize: 12, letterSpacing: '0.2em', color: '#7a8694', marginBottom: 28 }}>{reasonLabel[result.reason]}</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(140px,1fr) 2rem 2rem', gap: '0.35rem 1.4rem', marginBottom: 28 }}>
        <div style={{ color: 'var(--accent)', letterSpacing: '0.15em' }}>{t.matchScorePlayer}</div>
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
      <Button variant="primary" onClick={onExit} data-testid="match-exit">{t.matchExit}</Button>
    </div>
  )
}
