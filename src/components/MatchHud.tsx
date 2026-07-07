import type { PlayerScore } from '../hooks/useGameHUD'
import type { RosterEntry } from '../net/protocol'
import type { StreakTier } from '../game/streak'
import { streakDots } from '../game/overheat'
import { TEAM_COLORS } from '../constants'
import { EffectText } from './EffectText'
import { useT } from '../i18n'

interface MatchHudProps {
  scores: PlayerScore[]
  matchTime: number | null   // seconds remaining
  roster: RosterEntry[]
  localId: number
  streaks: Record<number, StreakTier | null>
  streakCounts: Record<number, number>
  ended?: boolean   // match end: the bar grows and moves to the center (final score)
}

function fmt(sec: number | null): string {
  if (sec === null) return '--:--'
  const s = Math.max(0, sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
}

/** Persistent HUD. Two players: your frags · timer · opponent frags (the pre-modes look, untouched).
 *  Three+: the timer over a compact score column (functional layout — visual design comes later). */
export function MatchHud({ scores, matchTime, roster, localId, streaks, streakCounts, ended = false }: MatchHudProps) {
  const t = useT()
  const kills = (id?: number) => (id !== undefined ? scores.find(s => s.id === id)?.kills ?? 0 : 0)
  // Streak dots (0 → none, capped at 10); color is inherited from the row (the player color).
  const dots = (id: number | undefined, testid: string) => {
    const n = id !== undefined ? streakDots(streakCounts[id] ?? 0) : 0
    return <span className="streak-dots" data-testid={testid} aria-hidden="true">{'●'.repeat(n)}</span>
  }
  // Name comes from the roster as-is: a human has their own, a bot has a generated "model" name.
  const nick = (entry: RosterEntry | undefined, fallback: string, testid: string) => {
    const name = entry ? entry.name : fallback
    const tier = entry ? (streaks[entry.id] ?? null) : null
    return <EffectText text={name} kind={tier} color={entry?.color ?? '#4af'} testid={testid} dataStreak={tier ?? undefined} />
  }

  if (roster.length > 2) {
    const scoreOf = (id: number) => scores.find(s => s.id === id)
    const rows = [...roster].sort((a, b) => kills(b.id) - kills(a.id) || a.id - b.id)
    const showTeamChips = new Set(scores.map(s => s.team)).size < roster.length   // 2v2 → grouped teams exist
    return (
      <div className={ended ? 'match-hud ended' : 'match-hud'} data-testid="match-hud" style={{ flexDirection: 'column', gap: 4 }}>
        <div className="timer">{fmt(matchTime)}</div>
        {rows.map(entry => {
          const s = scoreOf(entry.id)
          return (
            <div key={entry.id} data-testid={`hud-row-${entry.id}`}
              style={{ display: 'flex', gap: 8, alignItems: 'center', color: entry.color, opacity: s?.left ? 0.45 : 1 }}>
              {showTeamChips && <span aria-hidden="true" style={{ width: 8, height: 8, borderRadius: 2, background: TEAM_COLORS[s?.team ?? 0] ?? 'transparent' }} />}
              <span style={{ textDecoration: entry.id === localId ? 'underline' : undefined, textUnderlineOffset: 3 }}>
                {nick(entry, '', `hud-name-${entry.id}`)}
              </span>
              {dots(entry.id, `streak-dots-${entry.id}`)}
              <span className="frag">{kills(entry.id)}</span>
              {s?.left && <span aria-hidden="true">✕</span>}
            </div>
          )
        })}
      </div>
    )
  }

  const me = roster.find(r => r.id === localId)
  const opp = roster.find(r => r.id !== localId)
  return (
    <div className={ended ? 'match-hud ended' : 'match-hud'} data-testid="match-hud">
      <div className="side you" style={{ color: me?.color }}>
        {dots(me?.id, 'streak-dots-you')}<span>{nick(me, t.hudYou, 'hud-name-you')}</span>
        <span className="frag">{kills(me?.id)}</span>
      </div>
      <div className="timer">{fmt(matchTime)}</div>
      <div className="side opp" style={{ color: opp?.color }}>
        <span className="frag">{kills(opp?.id)}</span>
        <span>{nick(opp, t.hudOpponent, 'hud-name-opp')}</span>{dots(opp?.id, 'streak-dots-opp')}
      </div>
    </div>
  )
}
