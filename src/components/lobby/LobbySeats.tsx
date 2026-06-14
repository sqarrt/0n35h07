import { useState, useEffect, type CSSProperties } from 'react'
import { generateModelName } from '../../names'
import type { LobbySlot, OppSlot } from './types'

const NAME_CYCLE_MS = 300
const EMPTY_GLYPH = '—'
const pc = (color: string): CSSProperties => ({ ['--pc' as string]: color } as CSSProperties)

interface LobbySeatsProps {
  isHost: boolean
  me: LobbySlot
  opponent: OppSlot | null
  searching: boolean
}

/** Слоты лобби: игрок слева/справа по роли, VS по центру. Управление ролью/ботом/кодом — в разделе «// ПРОЧЕЕ». */
export function LobbySeats({ isHost, me, opponent, searching }: LobbySeatsProps) {
  // Крутящиеся имена в пустом слоте соперника во время поиска/подключения.
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

  const emptyOpponentSeat = () => (
    <div className="lobby-seat" data-testid="lobby-opponent">
      <span className="lobby-nick lobby-nick--searching" data-testid={spinning ? 'lobby-spin' : undefined}>{spinning ? spin : EMPTY_GLYPH}</span>
    </div>
  )

  const meSeat = filledSeat(me, true)
  const oppSeat = opponent ? filledSeat(opponent, false) : emptyOpponentSeat()

  return (
    <div className="lobby-seats">
      {isHost ? meSeat : oppSeat}
      <span className="lobby-vs">VS</span>
      {isHost ? oppSeat : meSeat}
    </div>
  )
}
