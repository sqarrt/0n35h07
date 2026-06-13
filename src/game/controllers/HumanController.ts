import * as THREE from 'three'
import type { Controller } from '../abstractions'
import type { Player } from '../Player'
import type { World } from '../World'
import { horizontalBasis, moveVelocity, dashDirection } from './movement'
import type { MoveKeys } from './movement'
import { toVec3 } from '../../net/protocol'
import type { InputFrame } from '../../net/protocol'
import {
  WINDUP_LOOK_FACTOR, TP_DIST, TP_HEIGHT, DASH_FOV, AIM_RANGE,
} from '../../constants'

type Keys = MoveKeys & { jump: boolean }   // + held-прыжок (auto-bhop), обрабатывается за кадр

/** Минимальный интерфейс контролов (drei PointerLockControls): используем только pointerSpeed. */
export interface PointerControls { pointerSpeed: number }

/** Человек: клавиши/мышь/камера → те же intent-методы Player, что и у бота. */
export class HumanController implements Controller {
  private thirdPerson = false
  private shakeFrames = 0
  private fov = 75
  private tmp = new THREE.Vector3()

  private player: Player
  private camera: THREE.PerspectiveCamera
  private keys: React.MutableRefObject<Keys>
  private controls: React.RefObject<PointerControls | null>
  private world: World
  // Рёберные действия за кадр — для сетевого InputFrame (клиент шлёт хосту). Прыжок — held (см. keys.jump).
  private pending = { fire: false, shield: false, dash: false }

  constructor(
    player: Player,
    camera: THREE.PerspectiveCamera,
    keys: React.MutableRefObject<Keys>,
    controls: React.RefObject<PointerControls | null>,
    world: World,
    startThirdPerson = false,
  ) {
    this.player = player
    this.camera = camera
    this.keys = keys
    this.controls = controls
    this.world = world
    this.thirdPerson = startThirdPerson
    player.setBodyVisible(startThirdPerson)   // стартовый вид по настройке (FP скрывает модель)
  }

  // --- рёберные события от DOM (вызывает хост) ---
  onFire()    { if (document.pointerLockElement) { this.player.startFiring();    this.pending.fire = true } }
  onShield()  { if (document.pointerLockElement) { this.player.activateShield(); this.pending.shield = true } }
  onDash() {
    if (!document.pointerLockElement) return
    this.pending.dash = true
    const world = this.camera.getWorldDirection(this.tmp)      // полный взгляд (с наклоном)
    const { right } = horizontalBasis(world)                   // strafe-ось — горизонтальная
    const d = dashDirection(this.keys.current, world.clone().normalize(), right)
    if (d) this.player.dash(d)
  }
  shake()     { this.shakeFrames = 5 }
  toggleView() {
    this.thirdPerson = !this.thirdPerson
    this.player.setBodyVisible(this.thirdPerson)
  }

  /** Камера-относительные горизонтальные оси (для движения и направления рывка). */
  private basis() {
    return horizontalBasis(this.camera.getWorldDirection(this.tmp))
  }

  /** Собрать кадр ввода для отправки хосту (клиент). Сбрасывает рёберные защёлки. */
  currentInputFrame(seq: number): InputFrame {
    const k = this.keys.current
    const look = this.camera.getWorldDirection(new THREE.Vector3())
    const frame: InputFrame = {
      seq,
      keys: { f: k.forward, b: k.back, l: k.left, r: k.right },
      aimDir: toVec3(look),
      jump: k.jump,   // held-состояние (не ребро) — auto-bhop/двойной прыжок считает Body на хосте
      fire: this.pending.fire,
      shield: this.pending.shield, dash: this.pending.dash,
    }
    this.pending = { fire: false, shield: false, dash: false }
    return frame
  }

  // --- intents (до физики) ---
  update(dt: number) {
    // Меню открыто (указатель не захвачен) — игрок не двигается, не целится, прыжок сбрасываем (без застрявшего bhop).
    if (!document.pointerLockElement) { this.player.setJumpInput(false); return }
    const { dir, right } = this.basis()
    this.player.moveIntent(moveVelocity(this.keys.current, dir, right, this.player.isWindingUp), dt)
    this.player.setJumpInput(this.keys.current.jump)   // held → auto-bhop/двойной прыжок (решает Body)

    // Прицел = точка мира под перекрестием: луч из камеры (исключая своё тело).
    const camDir = this.camera.getWorldDirection(new THREE.Vector3())
    this.player.setLook(camDir)   // ориентация модели — по взгляду камеры (стабильно, в т.ч. в TP)
    // В режиме SINGULARITY прицельный луч тоже простреливает блоки — иначе в TP aimPoint упирается
    // в ближнюю стену и луч летит в неё, а не сквозь стены в соперника.
    const hit = this.world.raycast(this.camera.position, camDir, [this.player.id], this.player.pierceWalls)
    const aimPoint = hit
      ? hit.point
      : this.camera.position.clone().addScaledVector(camDir, AIM_RANGE)
    this.player.aim(aimPoint)
  }

  // --- камера/вид (после физики) ---
  lateUpdate(dt: number) {
    const pos = this.player.position
    if (this.thirdPerson) {
      const lookH = this.camera.getWorldDirection(this.tmp).clone()
      lookH.y = 0
      lookH.normalize()
      this.camera.position.copy(pos).addScaledVector(lookH, -TP_DIST)
      this.camera.position.y = pos.y + TP_HEIGHT
    } else {
      this.camera.position.copy(pos)
    }

    if (this.shakeFrames > 0) {
      this.camera.position.x += (Math.random() - 0.5) * 0.04
      this.camera.position.y += (Math.random() - 0.5) * 0.04
      this.shakeFrames--
    }

    const moving = !!(this.keys.current.forward || this.keys.current.back ||
                      this.keys.current.left || this.keys.current.right)
    // Динамический FOV работает и в FP, и в TP; рывок и фаза призрака (×2 скорость) дают всплеск.
    const targetFov = (this.player.dashing || this.player.isRespawning) ? DASH_FOV
      : this.player.isWindingUp ? 70 : (moving ? 87 : 75)
    this.fov = THREE.MathUtils.lerp(this.fov, targetFov, dt * 6)
    this.camera.fov = this.fov
    this.camera.updateProjectionMatrix()

    if (this.controls.current) {
      this.controls.current.pointerSpeed = this.player.isWindingUp ? WINDUP_LOOK_FACTOR : 1
    }
  }
}
