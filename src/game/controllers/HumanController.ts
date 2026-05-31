import * as THREE from 'three'
import type { Controller } from '../abstractions'
import type { Player } from '../Player'
import type { World } from '../World'
import {
  MOVE_SPEED, WINDUP_MOVE_FACTOR, WINDUP_LOOK_FACTOR, TP_DIST, TP_HEIGHT,
} from '../../constants'

interface Keys { forward: boolean; back: boolean; left: boolean; right: boolean }
const UP = new THREE.Vector3(0, 1, 0)

/** Человек: клавиши/мышь/камера → те же intent-методы Player, что и у бота. */
export class HumanController implements Controller {
  private thirdPerson = false
  private shakeFrames = 0
  private fov = 75
  private tmp = new THREE.Vector3()

  private player: Player
  private camera: THREE.PerspectiveCamera
  private keys: React.MutableRefObject<Keys>
  private controls: React.RefObject<any>
  private world: World

  constructor(
    player: Player,
    camera: THREE.PerspectiveCamera,
    keys: React.MutableRefObject<Keys>,
    controls: React.RefObject<any>,
    world: World,
  ) {
    this.player = player
    this.camera = camera
    this.keys = keys
    this.controls = controls
    this.world = world
    player.setBodyVisible(false)   // старт в FP — модель скрыта
  }

  // --- рёберные события от DOM (вызывает хост) ---
  onFire()    { if (document.pointerLockElement) this.player.startFiring() }
  onShield()  { if (document.pointerLockElement) this.player.activateShield() }
  onJump()    { this.player.jump() }
  shake()     { this.shakeFrames = 5 }
  toggleView() {
    this.thirdPerson = !this.thirdPerson
    this.player.setBodyVisible(this.thirdPerson)
  }

  // --- intents (до физики) ---
  update(dt: number) {
    const dir = this.camera.getWorldDirection(this.tmp).clone()
    dir.y = 0
    dir.normalize()
    const right = new THREE.Vector3().crossVectors(dir, UP).normalize()

    const k = this.keys.current
    const vel = new THREE.Vector3()
    if (k.forward) vel.addScaledVector(dir, MOVE_SPEED)
    if (k.back)    vel.addScaledVector(dir, -MOVE_SPEED)
    if (k.left)    vel.addScaledVector(right, -MOVE_SPEED)
    if (k.right)   vel.addScaledVector(right, MOVE_SPEED)
    if (this.player.isWindingUp) vel.multiplyScalar(WINDUP_MOVE_FACTOR)
    this.player.moveIntent(vel, dt)

    // Прицел = точка мира под перекрестием: луч из камеры (исключая своё тело).
    const camDir = this.camera.getWorldDirection(new THREE.Vector3())
    const hit = this.world.raycast(this.camera.position, camDir, [this.player.id])
    const aimPoint = hit
      ? hit.point
      : this.camera.position.clone().addScaledVector(camDir, 100)
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
    const targetFov = this.thirdPerson ? 75 : (this.player.isWindingUp ? 70 : (moving ? 87 : 75))
    this.fov = THREE.MathUtils.lerp(this.fov, targetFov, dt * 6)
    this.camera.fov = this.fov
    this.camera.updateProjectionMatrix()

    if (this.controls.current) {
      this.controls.current.pointerSpeed = this.player.isWindingUp ? WINDUP_LOOK_FACTOR : 1
    }
  }
}
