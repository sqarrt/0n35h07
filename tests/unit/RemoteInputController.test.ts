import { describe, it, expect } from 'vitest'
import * as THREE from 'three'
import { Player } from '../../src/game/Player'
import { Body } from '../../src/game/Body'
import { BeamWeapon } from '../../src/game/BeamWeapon'
import { Shield } from '../../src/game/Shield'
import { World } from '../../src/game/World'
import { RemoteInputController } from '../../src/game/controllers/RemoteInputController'
import type { InputFrame } from '../../src/net/protocol'

function makePlayer() {
  return new Player(1, new Body(1, '#f44'), new BeamWeapon(), new Shield(), '#f44')
}
function frame(over: Partial<InputFrame> = {}): InputFrame {
  return {
    seq: 0, keys: { f: false, b: false, l: false, r: false }, aimDir: [0, 0, -1],
    jump: false, fire: false, shield: false, dash: false, ...over,
  }
}

describe('RemoteInputController — рёберные действия не теряются', () => {
  const world = new World(new THREE.Scene())

  it('fire из кадра, перезаписанного более свежим до update, всё равно применяется', () => {
    const p = makePlayer()
    const rc = new RemoteInputController(p, world)
    rc.enqueue(frame({ seq: 1, fire: true }))    // выстрел
    rc.enqueue(frame({ seq: 2, fire: false }))   // свежий кадр без выстрела перезаписал latest
    rc.update(0.016)
    expect(p.isWindingUp).toBe(true)             // выстрел не потерян
    expect(rc.ackSeq).toBe(2)                    // движение — из самого свежего кадра
  })

  it('рёберное действие применяется один раз (нет авто-повтора)', () => {
    const p = makePlayer()
    const rc = new RemoteInputController(p, world)
    rc.enqueue(frame({ seq: 1, shield: true }))
    rc.update(0.016)
    expect(p.shieldActive).toBe(true)
    p.activateShield()                           // сбросить нельзя — проверяем, что повтора нет
    rc.update(0.016)                             // без нового кадра — щит не пере-активируется этим контроллером
    expect(p.shieldActive).toBe(true)            // всё ещё активен (один цикл), без ошибок
  })
})
