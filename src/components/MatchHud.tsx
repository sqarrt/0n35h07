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
}

function fmt(sec: number | null): string {
  if (sec === null) return '--:--'
  const s = Math.max(0, sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
}

/** Persistent HUD. Two players: your frags · timer · opponent frags (the pre-modes look, untouched).
 *  Three+: the same centered bar, framed by player panes — two players per side, each with its
 *  personal frags; Battle adds team totals beside the timer and a team-color backing per pane. */
export function MatchHud({ scores, matchTime, roster, localId, streaks, streakCounts }: MatchHudProps) {
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
    const isBattle = new Set(scores.map(s => s.team)).size < roster.length   // grouped teams exist (2v2)
    // Sides are STABLE (no reordering by kills — rows must not jump mid-match):
    // Battle — my team left, enemies right; War — me first on the left, the rest split by id.
    let left: RosterEntry[]
    let right: RosterEntry[]
    if (isBattle) {
      const myTeam = scoreOf(localId)?.team ?? 0
      left = roster.filter(r => scoreOf(r.id)?.team === myTeam)
      right = roster.filter(r => scoreOf(r.id)?.team !== myTeam)
    } else {
      const others = roster.filter(r => r.id !== localId).sort((a, b) => a.id - b.id)
      const rightCount = Math.floor((others.length + 1) / 2)
      left = [roster.find(r => r.id === localId)!, ...others.slice(0, others.length - rightCount)].filter(Boolean)
      right = others.slice(others.length - rightCount)
    }
    const teamKills = (rs: RosterEntry[]) => rs.reduce((n, r) => n + kills(r.id), 0)
    const paneTint = (rs: RosterEntry[]) =>
      isBattle ? { background: `${TEAM_COLORS[scoreOf(rs[0]?.id)?.team ?? 0] ?? 'transparent'}26` } : undefined
    const row = (entry: RosterEntry, mirror: boolean) => {
      const s = scoreOf(entry.id)
      const cells = [
        dots(entry.id, `streak-dots-${entry.id}`),
        <span key="nm" style={{ textDecoration: entry.id === localId ? 'underline' : undefined, textUnderlineOffset: 3 }}>
          {nick(entry, '', `hud-name-${entry.id}`)}
        </span>,
        <span key="fr" className="frag">{kills(entry.id)}</span>,
      ]
      return (
        <div key={entry.id} className="mhud-row" data-testid={`hud-row-${entry.id}`}
          style={{ color: entry.color, justifyContent: mirror ? 'flex-end' : 'flex-start', opacity: s?.left ? 0.45 : 1 }}>
          {s?.left && <span aria-hidden="true">✕</span>}
          {mirror ? cells : [...cells].reverse()}
        </div>
      )
    }
    return (
      <div className="match-hud" data-testid="match-hud">
        <div className="mhud-team" style={paneTint(left)}>{left.map(e => row(e, true))}</div>
        {isBattle && <span className="frag" data-testid="hud-team-you">{teamKills(left)}</span>}
        <div className="timer">{fmt(matchTime)}</div>
        {isBattle && <span className="frag" data-testid="hud-team-opp">{teamKills(right)}</span>}
        <div className="mhud-team" style={paneTint(right)}>{right.map(e => row(e, false))}</div>
      </div>
    )
  }

  const me = roster.find(r => r.id === localId)
  const opp = roster.find(r => r.id !== localId)
  return (
    <div className="match-hud" data-testid="match-hud">
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
