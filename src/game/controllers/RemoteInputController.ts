import type { Controller } from '../abstractions'
import type { Player } from '../Player'
import type { World } from '../World'
import { intentsFromInput } from '../../net/input'
import type { InputFrame } from '../../net/protocol'

interface Edges { fire: boolean; shield: boolean; dash: boolean }
const noEdges = (): Edges => ({ fire: false, shield: false, dash: false })

/**
 * Хост: ведёт аватар удалённого игрока по присланным InputFrame через те же intent-методы,
 * что и человек (`intentsFromInput`). Движение/прицел берутся из самого свежего кадра
 * (экстраполяция до прихода нового), а рёберные действия (jump/fire/shield/dash)
 * **накапливаются** между шагами — иначе одиночный кадр с `fire` теряется, если до обработки
 * его перезапишет более свежий кадр (сообщения часто идут пачками).
 */
export class RemoteInputController implements Controller {
  private player: Player
  private world: World
  private latest: InputFrame | null = null
  private edges: Edges = noEdges()
  private appliedSeq = 0

  constructor(player: Player, world: World) {
    this.player = player
    this.world = world
  }

  /** Принять кадр: копим рёберные действия (fire/shield/dash); движение/прицел/прыжок(held) — из самого нового. */
  enqueue(frame: InputFrame) {
    this.edges.fire   ||= frame.fire
    this.edges.shield ||= frame.shield
    this.edges.dash   ||= frame.dash
    if (!this.latest || frame.seq >= this.latest.seq) this.latest = frame
  }

  update(dt: number) {
    if (!this.latest) return
    this.appliedSeq = this.latest.seq
    intentsFromInput(this.player, { ...this.latest, ...this.edges }, dt, this.world)
    this.edges = noEdges()
  }

  /** Последний применённый seq — хост кладёт в снапшот (ackSeq) для реконсиляции клиента. */
  get ackSeq() { return this.appliedSeq }
}
