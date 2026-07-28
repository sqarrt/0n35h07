import { useState, useEffect, type CSSProperties } from 'react'
import type { GameMode } from '../../game/modes'
import { TEAM_COLORS, type BotDifficulty } from '../../constants'
import { generateModelName } from '../../names'
import { NAME_MAX } from '../../settings'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'
import type { SeatView, SeatZone, PendingInvite } from './types'

const NAME_CYCLE_MS = 300
const CODE_COPIED_MS = 1500
const DIFFICULTIES: BotDifficulty[] = ['normal', 'passive']
const pc = (color: string): CSSProperties => ({ ['--pc' as string]: color } as CSSProperties)
const teamFrame = (team: number): CSSProperties => ({ borderColor: `${TEAM_COLORS[team] ?? 'transparent'}55` })

/** Steam (desktop): the invite zone opens the friend picker; sent invites render as "waiting" seats. */
export interface SeatsInviteCfg {
  pending: PendingInvite[]
  onInvite: (slot: number) => void
  onCancel: (id: string) => void
}

interface SeatsProps {
  mode: GameMode
  isHost: boolean
  seats: SeatView[]
  searching: boolean            // free seats spin random names, action zones are hidden
  onSeatClick: (slot: number, zone: SeatZone) => void
  onBotRemove: (slot: number) => void
  onBotName: (slot: number, name: string) => void
  onBotDifficulty: (slot: number, d: BotDifficulty) => void
  invite?: SeatsInviteCfg       // desktop host
  joinCode?: string | null      // web host: the invite zone reveals this room code instead
}

/** Bot name editable straight in the seat. A local draft while focused lets the field be cleared
 *  mid-edit (the session ignores empty names, so the roster value never goes blank). */
function BotNameInput({ slot, name, onBotName }: { slot: number; name: string; onBotName: SeatsProps['onBotName'] }) {
  const t = useT()
  const [draft, setDraft] = useState<string | null>(null)
  return (
    <input
      className="lobby-nick lobby-nick--edit" data-testid={`lobby-bot-name-${slot}`}
      value={draft ?? name} maxLength={NAME_MAX} placeholder={t.lobbyBotNamePlaceholder} aria-label={t.lobbyBotName}
      onFocus={() => setDraft(name)}
      onChange={e => { setDraft(e.target.value); onBotName(slot, e.target.value) }}
      onClick={e => e.stopPropagation()}
      onBlur={() => setDraft(null)}
    />
  )
}

/** Unified seat block for every mode: Duel — a pair with VS, Battle — two team columns with VS,
 *  War — a centered column of four. One seat renderer covers all occupant states. */
export function Seats({ mode, isHost, seats, searching, onSeatClick, onBotRemove, onBotName, onBotDifficulty, invite, joinCode }: SeatsProps) {
  const t = useT()
  const sfx = useSfx()
  const [copied, setCopied] = useState(false)

  // Spinning random names in the free seats while matchmaking fills them.
  const [spin, setSpin] = useState<Record<number, string>>({})
  const freeKey = seats.filter(s => s.entry === null).map(s => s.slot).join(',')
  useEffect(() => {
    if (!searching || !freeKey) { setSpin({}); return }
    const state = new Map(freeKey.split(',').map(sl => [Number(sl), { name: generateModelName(), dots: 0 }]))
    const tick = () => {
      setSpin(Object.fromEntries([...state].map(([sl, v]) => [sl, v.name + '.'.repeat(v.dots)])))
      for (const v of state.values()) { v.dots++; if (v.dots > 3) { v.dots = 0; v.name = generateModelName() } }
    }
    tick()
    const id = setInterval(tick, NAME_CYCLE_MS)
    return () => clearInterval(id)
  }, [searching, freeKey])

  // Sent invites are a VISUAL projection onto the first free seats (a friend takes the first free
  // slot on join — seats are not reserved).
  const inviteBySlot = new Map<number, PendingInvite>()
  if (invite) {
    const freeSlots = seats.filter(s => s.entry === null).map(s => s.slot)
    invite.pending.forEach((inv, i) => { if (i < freeSlots.length) inviteBySlot.set(freeSlots[i], inv) })
  }

  const copyCode = () => {
    if (!joinCode) return
    void navigator.clipboard?.writeText(joinCode).catch(() => { /* clipboard unavailable */ })
    setCopied(true); setTimeout(() => setCopied(false), CODE_COPIED_MS)
  }

  const seatBody = (s: SeatView) => {
    const waiting = s.entry === null ? inviteBySlot.get(s.slot) : undefined
    if (waiting) {
      return (
        <>
          <button className="lobby-seat-cancel" data-testid={`lobby-invite-cancel-${s.slot}`}
            onClick={e => { e.stopPropagation(); sfx.play2D('ui_toggle'); invite!.onCancel(waiting.id) }}>✕</button>
          <span className="lobby-nick">{waiting.name}</span>
          <span className="lobby-seat-wait"><span className="lobby-seat-waitdot" />{t.lobbyInvitedTag}</span>
        </>
      )
    }
    if (s.entry === null) {
      if (searching) return <span className="lobby-nick lobby-nick--searching" data-testid={`lobby-spin-${s.slot}`}>{spin[s.slot] ?? ''}</span>
      // Guest: a free seat is a "take this seat" zone — hover + label, the move must LOOK clickable.
      if (!isHost) {
        return (
          <button className="seat-zone" data-testid={`seat-take-${s.slot}`}
            onClick={() => { sfx.play2D('ui_toggle'); onSeatClick(s.slot, 'move') }}>{t.lobbyTakeSeat}</button>
        )
      }
      return (
        <>
          {/* Desktop: the invite zone opens the Steam friend picker. Web: the zone IS the room
              code — "send to a friend: <code>", click copies. */}
          {invite !== undefined && (
            <button className="seat-zone" data-testid={`seat-invite-${s.slot}`}
              onClick={() => { sfx.play2D('ui_toggle'); invite.onInvite(s.slot) }}>
              <span className="seat-zone-plus">＋</span>{t.lobbyInviteSection}
            </button>
          )}
          {invite === undefined && !!joinCode && (
            <button className="seat-zone" data-testid={`seat-code-${s.slot}`} onClick={copyCode} title={t.lobbyCopyHint}>
              <span className="seat-code-label">{t.lobbySendCode}</span>
              <span className="seat-code-text">{joinCode}</span><span className="seat-code-glyph">{copied ? '✓' : '⧉'}</span>
            </button>
          )}
          <button className="seat-zone" data-testid={`seat-addbot-${s.slot}`}
            onClick={() => { sfx.play2D('ui_toggle'); onSeatClick(s.slot, 'addbot') }}>{t.lobbyAddBot}</button>
        </>
      )
    }
    if (s.entry.isBot && isHost) {
      return (
        <>
          <button className="lobby-seat-cancel" data-testid={`lobby-bot-remove-${s.slot}`}
            onClick={e => { e.stopPropagation(); sfx.play2D('ui_toggle'); onBotRemove(s.slot) }}>✕</button>
          <BotNameInput slot={s.slot} name={s.entry.name} onBotName={onBotName} />
          <div className="seat-diff">
            {DIFFICULTIES.map(d => (
              <button key={d} className={`seg${(s.entry!.difficulty ?? 'normal') === d ? ' seg--on' : ''}`}
                data-testid={`seat-diff-${s.slot}-${d}`}
                onClick={e => { e.stopPropagation(); sfx.play2D('ui_toggle'); onBotDifficulty(s.slot, d) }}>
                {d === 'normal' ? t.roomDiffNormal : t.roomDiffPassive}
              </button>
            ))}
          </div>
        </>
      )
    }
    return <span className={`lobby-nick${s.mine ? ' lobby-nick--you' : ''}`}>{s.entry.name}</span>
  }

  const seat = (s: SeatView) => {
    const waiting = s.entry === null ? inviteBySlot.get(s.slot) : undefined
    // Seat-level click: the host rerolls a bot's name (free seats act through their zones).
    const botReroll = isHost && s.entry?.isBot === true
    const click = () => {
      if (botReroll) { sfx.play2D('ui_toggle'); onBotName(s.slot, generateModelName()) }
    }
    const free = s.entry === null && !waiting && !searching
    return (
      <div key={s.slot}
        className={`lobby-seat${s.entry?.ready ? ' lobby-seat--ready' : ''}${s.entry?.isBot ? ' lobby-seat--bot' : ''}${waiting ? ' lobby-seat--waiting' : ''}${free ? ' lobby-seat--free' : ''}`}
        style={{ ...(s.entry ? pc(s.entry.color) : {}), position: 'relative', cursor: botReroll ? 'pointer' : undefined }}
        data-testid={`lobby-seat-${s.slot}`} data-mine={s.mine || undefined}
        onClick={click}
      >
        {seatBody(s)}
      </div>
    )
  }

  if (mode === '2v2') {
    return (
      <div className="lobby-seats seats-2v2" data-testid="lobby-seats" data-mode={mode}>
        <div className="seats-col" style={teamFrame(0)}>{seats.filter(s => s.team === 0).map(seat)}</div>
        <span className="lobby-vs">VS</span>
        <div className="seats-col" style={teamFrame(1)}>{seats.filter(s => s.team === 1).map(seat)}</div>
      </div>
    )
  }
  if (mode === 'ffa') {
    return <div className="lobby-seats seats-ffa" data-testid="lobby-seats" data-mode={mode}>{seats.map(seat)}</div>
  }
  return (
    <div className="lobby-seats seats-1v1" data-testid="lobby-seats" data-mode={mode}>
      {seat(seats[0])}
      <span className="lobby-vs">VS</span>
      {seat(seats[1])}
    </div>
  )
}
