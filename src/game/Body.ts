import * as THREE from 'three'
import {
  EYE_HEIGHT, GRAVITY, JUMP_FORCE, BODY_MESH_Y, HITBOX_Y,
} from '../constants'

/**
 * Физическое тело сущности: позиция (точка на уровне глаз), вертикальная физика,
 * меш-сфера (визуал) и хитбокс (raycast-цель с entityId). Едино для игрока и ботов.
 */
export class Body {
  readonly position = new THREE.Vector3(0, EYE_HEIGHT, 0)
  readonly object3d = new THREE.Group()
  readonly mesh:     THREE.Mesh
  readonly material: THREE.MeshStandardMaterial

  private velocityY = 0
  private onGround  = true

  constructor(entityId: number, color: string) {
    this.material = new THREE.MeshStandardMaterial({ color })
    this.mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 16, 16), this.material)
    this.mesh.position.y = BODY_MESH_Y
    this.mesh.castShadow = true
    this.mesh.userData.noRaycast = true

    const hitbox = new THREE.Mesh(
      new THREE.BoxGeometry(1, 2, 1),
      new THREE.MeshBasicMaterial({ visible: false }),
    )
    hitbox.position.y = HITBOX_Y
    hitbox.visible = false
    hitbox.userData.entityId = entityId

    this.object3d.add(this.mesh, hitbox)
  }

  move(worldDir: THREE.Vector3, dt: number) {
    this.position.x += worldDir.x * dt
    this.position.z += worldDir.z * dt
  }

  jump() {
    if (this.onGround) {
      this.velocityY = JUMP_FORCE
      this.onGround = false
    }
  }

  update(dt: number) {
    if (!this.onGround) {
      this.velocityY += GRAVITY * dt
      this.position.y += this.velocityY * dt
    }
    if (this.position.y <= EYE_HEIGHT) {
      this.position.y = EYE_HEIGHT
      this.velocityY = 0
      this.onGround = true
    }
    this.object3d.position.copy(this.position)
  }

  setPosition(p: THREE.Vector3) {
    this.position.copy(p)
    this.velocityY = 0
    this.onGround = p.y <= EYE_HEIGHT + 0.01
    this.object3d.position.copy(this.position)
  }

  setVisible(v: boolean) {
    this.mesh.visible = v
  }

  dispose() {
    this.mesh.geometry.dispose()
    this.material.dispose()
    const hb = this.object3d.children[1] as THREE.Mesh
    hb.geometry.dispose()
    ;(hb.material as THREE.Material).dispose()
  }
}
