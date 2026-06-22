import { useState, useEffect, type CSSProperties } from 'react'
import { generateModelName } from '../../names'
import { useT } from '../../i18n'
import { useSfx } from '../../sfx/SfxContext'
import { NAME_MAX } from '../../settings'
import type { LobbySlot, OppSlot } from './types'

const NAME_CYCLE_MS = 300
const EMPTY_GLYPH = '—'
const pc = (color: string): CSSProperties => ({ ['--pc' as string]: color } as CSSProperties)

/** Inline editing of the bot's name straight in the opponent seat (host, "Vs. bot" tab). */
export interface BotSeatEdit { name: string; onSetName: (name: string) => void }

interface LobbySeatsProps {
  isHost: boolean
  me: LobbySlot
  opponent: OppSlot | null
  searching: boolean
  botEdit?: BotSeatEdit   // present → the bot opponent's name is editable in its seat (+ 🎲 reroll)
}

/** Lobby slots: player left/right by role, VS in the center. Role/bot/code controls live in the "// MISC" section. */
export function LobbySeats({ isHost, me, opponent, searching, botEdit }: LobbySeatsProps) {
  const t = useT()
  const sfx = useSfx()
  // Spinning names in the empty opponent slot while searching/connecting.
  const [spin, setSpin] = useState('')
  const spinning = searching && !opponent
  useEffect(() => {
    if (!spinning) return
    let name = generateModelName(), dots = 0
    const tick = () => { setSpin(name + '.'.repeat(dots)); dots++; if (dots > 3) { dots = 0; name = generateModelName() } }
    tick()
    const id = setInterval(tick, NAME_CYCLE_MS)
    return () => clearInterval(id)
  }, [spinning])

  const filledSeat = (slot: LobbySlot, mine: boolean) => (
    <div className={`lobby-seat${slot.ready ? ' lobby-seat--ready' : ''}`} style={pc(slot.color)} data-testid={mine ? 'lobby-me' : 'lobby-opponent'}>
      <span className={`lobby-nick${mine ? ' lobby-nick--you' : ''}`}>{slot.name}</span>
    </div>
  )

  // Bot opponent with the name editable right in the seat (one place to see AND change it).
  // Click the seat → reroll a random name; click the name input → edit it (the input stops the
  // click from bubbling). Blur with an empty name reverts to the current one — the bot is never nameless.
  const botSeat = (slot: OppSlot, edit: BotSeatEdit) => {
    const reroll = () => { sfx.play2D('ui_toggle'); edit.onSetName(generateModelName()) }
    return (
      <div
        className={`lobby-seat lobby-seat--bot${slot.ready ? ' lobby-seat--ready' : ''}`} style={pc(slot.color)}
        data-testid="lobby-opponent" title={t.lobbyBotNameRandom} onClick={reroll}
      >
        <input
          className="lobby-nick lobby-nick--edit" data-testid="lobby-bot-name"
          value={edit.name} maxLength={NAME_MAX} placeholder={t.lobbyBotNamePlaceholder} aria-label={t.lobbyBotName}
          onChange={e => edit.onSetName(e.target.value)}
          onClick={e => e.stopPropagation()}
          onBlur={() => { if (!edit.name.trim()) edit.onSetName(slot.name) }}
        />
      </div>
    )
  }

  const emptyOpponentSeat = () => (
    <div className="lobby-seat" data-testid="lobby-opponent">
      <span className="lobby-nick lobby-nick--searching" data-testid={spinning ? 'lobby-spin' : undefined}>{spinning ? spin : EMPTY_GLYPH}</span>
    </div>
  )

  const meSeat = filledSeat(me, true)
  const oppSeat = opponent
    ? (botEdit ? botSeat(opponent, botEdit) : filledSeat(opponent, false))
    : emptyOpponentSeat()

  return (
    <div className="lobby-seats">
      {isHost ? meSeat : oppSeat}
      <span className="lobby-vs">VS</span>
      {isHost ? oppSeat : meSeat}
    </div>
  )
}
