import { type CSSProperties } from 'react'
import type { GameMode } from '../../game/modes'
import { TEAM_COLORS } from '../../constants'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'
import type { SeatView, PendingInvite } from './types'

const EMPTY_GLYPH = '—'
const BOT_GLYPH = '🤖'
const pc = (color: string): CSSProperties => ({ ['--pc' as string]: color } as CSSProperties)
const teamBox = (team: number): CSSProperties => ({
  display: 'flex', gap: 8, padding: 6, borderRadius: 8,
  border: `1px solid ${TEAM_COLORS[team] ?? 'transparent'}55`,
})
const cornerBtn: CSSProperties = { position: 'absolute', top: 2, right: 2, lineHeight: 1 }

/** Steam friend tab (host): empty seats become invite CTAs, sent invites render as "waiting" seats. */
export interface GridInviteCfg {
  pending: PendingInvite[]
  onInvite: () => void          // open the friend picker
  onCancel: (id: string) => void
}

interface LobbySeatsGridProps {
  mode: GameMode        // '2v2' → two team groups with VS; 'ffa' → a flat row
  isHost: boolean
  seats: SeatView[]
  onSeatClick: (slot: number) => void   // host: empty → add bot, bot → reroll its name; client: empty → move here
  onBotRemove: (slot: number) => void   // host only (✕ on a bot seat)
  invite?: GridInviteCfg                // present ONLY on the Steam friend tab for the host
}

/** Multi-seat lobby (2v2/FFA). The classic 1v1 pair keeps its own component (LobbySeats) untouched.
 *  Functional layout — the visual design pass comes later via frontend-design. */
export function LobbySeatsGrid({ mode, isHost, seats, onSeatClick, onBotRemove, invite }: LobbySeatsGridProps) {
  const t = useT()
  const sfx = useSfx()

  // Sent invites are a VISUAL projection onto the first free seats (a friend takes the first free slot on join —
  // seats are not reserved). Map: seat slot → pending invite shown there.
  const inviteBySlot = new Map<number, PendingInvite>()
  if (invite) {
    const freeSlots = seats.filter(s => s.entry === null).map(s => s.slot)
    invite.pending.forEach((inv, i) => { if (i < freeSlots.length) inviteBySlot.set(freeSlots[i], inv) })
  }

  const seat = (s: SeatView) => {
    const waiting = s.entry === null ? inviteBySlot.get(s.slot) : undefined
    const asInviteCta = invite !== undefined && s.entry === null && !waiting
    const clickable = !s.mine && (isHost || s.entry === null) && !waiting
    const click = () => {
      if (!clickable) return
      sfx.play2D('ui_toggle')
      if (asInviteCta) invite!.onInvite()
      else onSeatClick(s.slot)
    }
    return (
      <div key={s.slot}
        className={`lobby-seat${s.entry?.ready ? ' lobby-seat--ready' : ''}${s.entry?.isBot ? ' lobby-seat--bot' : ''}${waiting ? ' lobby-seat--waiting' : ''}${asInviteCta ? ' lobby-seat--invite' : ''}`}
        style={{ ...(s.entry ? pc(s.entry.color) : {}), position: 'relative', cursor: clickable ? 'pointer' : undefined }}
        data-testid={`lobby-seat-${s.slot}`}
        data-mine={s.mine || undefined}
        onClick={click}
        title={s.entry === null && isHost && !asInviteCta ? t.lobbyBot : undefined}
      >
        {isHost && s.entry?.isBot && (
          <button className="lobby-seat-cancel" data-testid={`lobby-bot-remove-${s.slot}`}
            onClick={e => { e.stopPropagation(); sfx.play2D('ui_toggle'); onBotRemove(s.slot) }}>✕</button>
        )}
        {waiting && (
          <>
            <button className="lobby-seat-cancel" data-testid={`lobby-invite-cancel-${s.slot}`}
              onClick={e => { e.stopPropagation(); sfx.play2D('ui_toggle'); invite!.onCancel(waiting.id) }}>✕</button>
            <span className="lobby-nick">{waiting.name}</span>
            <span className="lobby-seat-wait"><span className="lobby-seat-waitdot" />{t.lobbyInvitedTag}</span>
          </>
        )}
        {asInviteCta && (
          <>
            {/* Corner bot button: the CTA owns the seat click, bots move to the corner (host only). */}
            <button className="lobby-seat-cancel" style={cornerBtn} data-testid={`lobby-seat-bot-${s.slot}`}
              aria-label={t.lobbyBot}
              onClick={e => { e.stopPropagation(); sfx.play2D('ui_toggle'); onSeatClick(s.slot) }}>{BOT_GLYPH}</button>
            <span className="lobby-seat-plus">＋</span>
            <span className="lobby-seat-cta">{t.lobbyInviteSection}</span>
          </>
        )}
        {!waiting && !asInviteCta && (
          <span className={`lobby-nick${s.mine ? ' lobby-nick--you' : ''}${s.entry ? '' : ' lobby-nick--searching'}`}>
            {s.entry ? s.entry.name : EMPTY_GLYPH}
          </span>
        )}
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
