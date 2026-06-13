import type { PlayerScore } from '../hooks/useGameHUD'
import type { RosterEntry } from '../net/protocol'
import type { StreakTier } from '../game/streak'
import { EffectText } from './EffectText'
import { useT } from '../i18n'

interface MatchHudProps {
  scores: PlayerScore[]
  matchTime: number | null   // секунды остатка
  roster: RosterEntry[]
  localId: number
  streaks: Record<number, StreakTier | null>
}

function fmt(sec: number | null): string {
  if (sec === null) return '--:--'
  const s = Math.max(0, sec)
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m.toString().padStart(2, '0')}:${r.toString().padStart(2, '0')}`
}

/** Постоянный HUD: ваши фраги · таймер · фраги соперника. Ник на серии подсвечивается эффектом тира. */
export function MatchHud({ scores, matchTime, roster, localId, streaks }: MatchHudProps) {
  const t = useT()
  const me = roster.find(r => r.id === localId)
  const opp = roster.find(r => r.id !== localId)
  const kills = (name?: string) => scores.find(s => s.name === name)?.kills ?? 0
  // Имя берём из ростера как есть: у человека — своё, у бота — сгенерированное имя-«модель».
  const display = (entry: RosterEntry | undefined, fallback: string) => entry ? entry.name : fallback
  const nick = (entry: RosterEntry | undefined, fallback: string, testid: string) => {
    const name = display(entry, fallback)
    const tier = entry ? (streaks[entry.id] ?? null) : null
    return <EffectText text={name} kind={tier} color={entry?.color ?? '#4af'} slot testid={testid} dataStreak={tier ?? undefined} />
  }
  return (
    <div className="match-hud">
      <div className="side you" style={{ color: me?.color }}>
        <span className="dot">●</span><span>{nick(me, t.hudYou, 'hud-name-you')}</span>
        <span className="frag">{kills(me?.name)}</span>
      </div>
      <div className="timer">{fmt(matchTime)}</div>
      <div className="side opp" style={{ color: opp?.color }}>
        <span className="frag">{kills(opp?.name)}</span>
        <span>{nick(opp, t.hudOpponent, 'hud-name-opp')}</span><span className="dot">●</span>
      </div>
    </div>
  )
}
