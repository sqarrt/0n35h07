import type { Controller } from '../abstractions'
import type { Player } from '../Player'
import type { World } from '../World'
import { intentsFromInput } from '../../net/input'
import type { InputFrame } from '../../net/protocol'

/**
 * Хост: ведёт аватар удалённого игрока по присланным InputFrame через те же intent-методы,
 * что и человек (`intentsFromInput`). Движение/прицел применяются каждый кадр (экстраполяция
 * последнего ввода до прихода нового); рёберные действия (jump/fire/shield/dash) — один раз.
 */
export class RemoteInputController implements Controller {
  private player: Player
  private world: World
  private latest: InputFrame | null = null
  private appliedSeq = 0

  constructor(player: Player, world: World) {
    this.player = player
    this.world = world
  }

  /** Принять кадр от клиента (игнорируем устаревшие из-за переупорядочивания). */
  enqueue(frame: InputFrame) {
    if (!this.latest || frame.seq >= this.latest.seq) this.latest = frame
  }

  update(dt: number) {
    if (!this.latest) return
    this.appliedSeq = this.latest.seq
    intentsFromInput(this.player, this.latest, dt, this.world)
    // Гасим рёберные действия, оставляя keys/aim для непрерывного движения до нового кадра.
    this.latest = { ...this.latest, jump: false, fire: false, shield: false, dash: false }
  }

  /** Последний применённый seq — хост кладёт в снапшот (ackSeq) для реконсиляции клиента. */
  get ackSeq() { return this.appliedSeq }
}
