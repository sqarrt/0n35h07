import type { CSSProperties } from 'react'
import type { MatchResult } from '../hooks/useGameHUD'
import type { RosterEntry } from '../net/protocol'
import type { StreakTier } from '../game/streak'
import { EffectText } from './EffectText'
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
// Content-hugging two-column table centered as a block: every name ends at the shared column
// edge, the scores line up in their own narrow column right after it.
const rankingBox: CSSProperties = {
  display: 'grid', gridTemplateColumns: 'auto auto', justifyContent: 'center', columnGap: 28, rowGap: 12,
  alignItems: 'baseline', fontSize: 18, letterSpacing: '0.12em',
}
const reason: CSSProperties = { fontSize: 12, letterSpacing: '0.2em', color: '#7a8694' }

interface MatchEndedOverlayProps {
  result: MatchResult
  roster: RosterEntry[]                       // player colors for the ranking rows
  streaks: Record<number, StreakTier | null>  // keep the HUD's streak text effect on the names
  onExit: () => void
}

/** Match-end screen: outcome + every player ranked by kills (all modes, HUD colors/effects) + reason + EXIT. */
export function MatchEndedOverlay({ result, roster, streaks, onExit }: MatchEndedOverlayProps) {
  const t = useT()
  const color = OUTCOME_COLOR[result.outcome]
  const outcomeLabel: Record<MatchResult['outcome'], string> = {
    win: t.matchOutcomeWin, lose: t.matchOutcomeLose, draw: t.matchOutcomeDraw,
  }
  const reasonLabel: Record<MatchResult['reason'], string> = {
    time: t.matchReasonTime, disconnect: t.matchReasonDisconnect,
  }
  const players = [...result.scores].sort((a, b) => b.kills - a.kills || a.id - b.id)
  const colorOf = (id: number) => roster.find(r => r.id === id)?.color ?? 'var(--text)'
  return (
    <div style={wrap}>
      <style>{FADE}</style>
      <h1 data-testid="match-outcome" style={{ ...outcome, color, textShadow: `0 0 26px ${color}` }}>
        {outcomeLabel[result.outcome]}
      </h1>
      <div style={rankingBox} data-testid="match-ranking">
        {players.map((p, i) => (
          <div key={p.id} style={{ display: 'contents' }} data-testid={`match-rank-${i}`}>
            <span style={{ justifySelf: 'end', color: colorOf(p.id), opacity: p.left ? 0.45 : 1 }}>
              <EffectText text={p.name} kind={streaks[p.id] ?? null} color={colorOf(p.id)} testid={`match-rank-name-${i}`} />
              {p.left ? ' ✕' : ''}
            </span>
            <span style={{ justifySelf: 'start', fontSize: 22, color: colorOf(p.id), opacity: p.left ? 0.45 : 1 }}>{p.kills}</span>
          </div>
        ))}
      </div>
      <div data-testid="match-reason" style={reason}>{reasonLabel[result.reason]}</div>
      <Button variant="primary" onClick={onExit} data-testid="match-exit">{t.matchExit}</Button>
    </div>
  )
}
