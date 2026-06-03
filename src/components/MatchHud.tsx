import type { PlayerScore } from '../hooks/useGameHUD'
import type { RosterEntry } from '../net/protocol'

interface MatchHudProps {
  scores: PlayerScore[]
  matchTime: number | null   // секунды остатка
  roster: RosterEntry[]
  localId: number
}

function fmt(sec: number | null): string {
  if (sec === null) return '--:--'
  const s = Math.max(0, sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
}

/** Постоянный HUD: ваши фраги · таймер · фраги соперника (вместо Tab-скорборда). */
export function MatchHud({ scores, matchTime, roster, localId }: MatchHudProps) {
  const me = roster.find(r => r.id === localId)
  const opp = roster.find(r => r.id !== localId)
  const kills = (name?: string) => scores.find(s => s.name === name)?.kills ?? 0
  return (
    <div className="match-hud">
      <div className="side you" style={{ color: me?.color }}>
        <span className="dot">●</span><span><div className="nm">{me?.name ?? 'ВЫ'}</div></span>
        <span className="frag">{kills(me?.name)}</span>
      </div>
      <div className="timer">{fmt(matchTime)}</div>
      <div className="side opp" style={{ color: opp?.color }}>
        <span className="frag">{kills(opp?.name)}</span>
        <span><div className="nm">{opp?.name ?? 'СОПЕРНИК'}</div></span><span className="dot">●</span>
      </div>
    </div>
  )
}
