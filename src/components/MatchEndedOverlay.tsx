import type { CSSProperties } from 'react'
import type { MatchResult } from '../hooks/useGameHUD'
import { Button } from '../ui/Button'
import { useT } from '../i18n'

// Outcome color is semantic, not text; the label comes from the dictionary by outcome key.
const OUTCOME_COLOR: Record<MatchResult['outcome'], string> = {
  win:  'var(--ok)',
  lose: 'var(--danger)',
  draw: '#fd4',
}

const FADE = '@keyframes matchEndFade { from { opacity: 0 } to { opacity: 1 } }'

// One centered column (outcome → ranked players → reason → EXIT): nothing is absolutely
// positioned against anything else, so the blocks can never overlap.
const wrap: CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 30, background: 'rgba(7,10,14,0.9)',
  fontFamily: 'var(--ui-font)', color: 'var(--text)',
  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 26,
  animation: 'matchEndFade 0.1s ease-out',   // brief fade-in after the match-end freeze frame
}
const outcome: CSSProperties = {
  margin: 0, fontSize: 52, letterSpacing: '0.22em', paddingLeft: '0.22em', textAlign: 'center',
}
const rankingBox: CSSProperties = {
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8,
  fontSize: 17, letterSpacing: '0.12em',
}
const rankRow: CSSProperties = { display: 'flex', alignItems: 'baseline', gap: 14 }
const rankIdx: CSSProperties = { fontSize: 12, color: '#5a6572', width: 18, textAlign: 'right' }
const rankKills: CSSProperties = { fontSize: 20 }
const reason: CSSProperties = { fontSize: 12, letterSpacing: '0.2em', color: '#7a8694' }

/** Match-end screen: outcome + every player ranked by kills (all modes) + reason + EXIT. */
export function MatchEndedOverlay({ result, onExit }: { result: MatchResult; onExit: () => void }) {
  const t = useT()
  const color = OUTCOME_COLOR[result.outcome]
  const outcomeLabel: Record<MatchResult['outcome'], string> = {
    win: t.matchOutcomeWin, lose: t.matchOutcomeLose, draw: t.matchOutcomeDraw,
  }
  const reasonLabel: Record<MatchResult['reason'], string> = {
    time: t.matchReasonTime, disconnect: t.matchReasonDisconnect,
  }
  const players = [...result.scores].sort((a, b) => b.kills - a.kills || a.id - b.id)
  return (
    <div style={wrap}>
      <style>{FADE}</style>
      <h1 data-testid="match-outcome" style={{ ...outcome, color, textShadow: `0 0 26px ${color}` }}>
        {outcomeLabel[result.outcome]}
      </h1>
      <div style={rankingBox} data-testid="match-ranking">
        {players.map((p, i) => (
          <div key={p.id} style={{ ...rankRow, opacity: p.left ? 0.45 : 1 }} data-testid={`match-rank-${i}`}>
            <span style={rankIdx} aria-hidden="true">{i + 1}.</span>
            <span>{p.name}{p.left ? ' ✕' : ''}</span>
            <span style={rankKills}>{p.kills}</span>
          </div>
        ))}
      </div>
      <div data-testid="match-reason" style={reason}>{reasonLabel[result.reason]}</div>
      <Button variant="primary" onClick={onExit} data-testid="match-exit">{t.matchExit}</Button>
    </div>
  )
}
