import { type CSSProperties } from 'react'
import type { GameMode } from '../../game/modes'
import { TEAM_COLORS } from '../../constants'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'
import type { SeatView } from './types'

const EMPTY_GLYPH = '—'
const pc = (color: string): CSSProperties => ({ ['--pc' as string]: color } as CSSProperties)
const teamBox = (team: number): CSSProperties => ({
  display: 'flex', gap: 8, padding: 6, borderRadius: 8,
  border: `1px solid ${TEAM_COLORS[team] ?? 'transparent'}55`,
})

interface LobbySeatsGridProps {
  mode: GameMode        // '2v2' → two team groups with VS; 'ffa' → a flat row
  isHost: boolean
  seats: SeatView[]
  onSeatClick: (slot: number) => void   // host: empty → add bot, bot → reroll its name; client: empty → move here
  onBotRemove: (slot: number) => void   // host only (✕ on a bot seat)
}

/** Multi-seat lobby (2v2/FFA). The classic 1v1 pair keeps its own component (LobbySeats) untouched.
 *  Functional layout — the visual design pass comes later via frontend-design. */
export function LobbySeatsGrid({ mode, isHost, seats, onSeatClick, onBotRemove }: LobbySeatsGridProps) {
  const t = useT()
  const sfx = useSfx()

  const seat = (s: SeatView) => {
    const clickable = !s.mine && (isHost || s.entry === null)
    const click = () => { if (!clickable) return; sfx.play2D('ui_toggle'); onSeatClick(s.slot) }
    return (
      <div key={s.slot}
        className={`lobby-seat${s.entry?.ready ? ' lobby-seat--ready' : ''}${s.entry?.isBot ? ' lobby-seat--bot' : ''}`}
        style={{ ...(s.entry ? pc(s.entry.color) : {}), position: 'relative', cursor: clickable ? 'pointer' : undefined }}
        data-testid={`lobby-seat-${s.slot}`}
        data-mine={s.mine || undefined}
        onClick={click}
        title={s.entry === null && isHost ? t.lobbyBot : undefined}
      >
        {isHost && s.entry?.isBot && (
          <button className="lobby-seat-cancel" data-testid={`lobby-bot-remove-${s.slot}`}
            onClick={e => { e.stopPropagation(); sfx.play2D('ui_toggle'); onBotRemove(s.slot) }}>✕</button>
        )}
        <span className={`lobby-nick${s.mine ? ' lobby-nick--you' : ''}${s.entry ? '' : ' lobby-nick--searching'}`}>
          {s.entry ? s.entry.name : EMPTY_GLYPH}
        </span>
      </div>
    )
  }

  if (mode === '2v2') {
    return (
      <div className="lobby-seats" data-testid="lobby-seats-grid">
        <div style={teamBox(0)}>{seats.filter(s => s.team === 0).map(seat)}</div>
        <span className="lobby-vs">VS</span>
        <div style={teamBox(1)}>{seats.filter(s => s.team === 1).map(seat)}</div>
      </div>
    )
  }
  return (
    <div className="lobby-seats" data-testid="lobby-seats-grid" style={{ gap: 8 }}>
      {seats.map(seat)}
    </div>
  )
}
