/**
 * Финал трейлера: сверх-замедленный встречный выстрел. Вид сбоку (игроки слева/справа), камера медленно
 * отъезжает с замедлением (ease-out). Два игрока с РАЗНЫМИ скинами (цвет+модель+скин выстрела) заряжают и
 * стреляют друг в друга; время почти останавливается — клип замирает на двух ЛЕТЯЩИХ навстречу лучах.
 * Реальные ресурсы игры: Body + createWindupFx + BeamWeapon(createBeamFx) — настоящие скины заряда/луча.
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { EffectComposer, Bloom } from '@react-three/postprocessing'
import * as THREE from 'three'
import { Body } from '../../game/Body'
import { BeamWeapon } from '../../game/BeamWeapon'
import { createBeamFx } from '../../game/fx/beam/createBeamFx'
import { createWindupFx } from '../../game/fx/windup/createWindupFx'
import { BODY_MESH_Y } from '../../constants'
import type { WindupStyle, BallModel } from '../../constants'
import type { WeaponContext } from '../../game/abstractions'
import type { World } from '../../game/World'
import type { SfxEvent } from '../../game/audio/sfx/types'

interface Fighter { color: string; ring: string; model: BallModel; windup: WindupStyle; x: number }
// Разные скины: цвет + модель + скин выстрела (windup/beam) у каждого.
const A: Fighter = { color: '#4ff', ring: '#fa4', model: 'planet', windup: 'rage', x: -6.5 }
const B: Fighter = { color: '#f4a', ring: '#4ff', model: 'waves', windup: 'singularity', x: 6.5 }

const ORB_Y = 1.0
const CENTER_Y = ORB_Y + BODY_MESH_Y
const CHARGE_DUR = 1.0          // длительность заряда (в slow-mo времени)
const SLOWMO_CHARGE = 0.35      // множитель времени при заряде
const SLOWMO_HOLD = 0.05        // после выстрела время почти стоит (лучи «висят»)
const CAM_Z0 = 10.5, CAM_Z1 = 18 // отъезд камеры (игроки разведены на ±6.5 — нужен запас)
const CAM_DUR = 7.0             // секунд реального времени на отъезд (ease-out)
const FINALE_DUR = 7.5          // когда финал завершится (onEnd)
const BEAM_REACH = 0.46         // лучи долетают до 46% (ещё не встретились)

const beamCtx = (): WeaponContext => ({
  world: { raycast: () => null } as unknown as World,
  muzzle: new THREE.Vector3(), aim: new THREE.Vector3(0, 0, -1), excludeIds: [],
})
const _cA = new THREE.Vector3(), _cB = new THREE.Vector3(), _endA = new THREE.Vector3(), _endB = new THREE.Vector3(), _dir = new THREE.Vector3()

function makeSide(f: Fighter) {
  const body = new Body(f.x < 0 ? -201 : -202, f.color, f.model, f.ring)
  body.object3d.position.set(f.x, ORB_Y, 0)
  body.setOpacity(1)
  return {
    body,
    windup: createWindupFx(f.windup),
    beam: new BeamWeapon({ outerColor: f.color, beamFx: createBeamFx(f.windup, f.color) }),
    color: new THREE.Color(f.color),
    x: f.x,
  }
}

export function FinaleScene({ onSfx, onEnd }: { onSfx: (e: SfxEvent) => void; onEnd: () => void }) {
  const camera = useThree(s => s.camera)
  const [sides, setSides] = useState<ReturnType<typeof makeSide>[]>([])
  useEffect(() => {
    const s = [makeSide(A), makeSide(B)]
    setSides(s)
    return () => s.forEach(x => { x.body.dispose(); x.windup.dispose(); x.beam.dispose() })
  }, [])

  const realT = useRef(0)
  const localT = useRef(0)
  const fired = useRef(false)
  const ended = useRef(false)
  const ctx = useRef<WeaponContext>(beamCtx())
  const windupFrame = useMemo(() => ({
    progress: 0, shrink: 1, baseColor: new THREE.Color('#fff'),
    aimDir: new THREE.Vector3(), origin: new THREE.Vector3(), visible: true,
  }), [])

  useFrame((_, dtRaw) => {
    if (!sides.length || ended.current) return
    const dt = Math.min(dtRaw, 0.05)
    realT.current += dt
    localT.current += dt * (fired.current ? SLOWMO_HOLD : SLOWMO_CHARGE)

    // Камера сбоку, медленный отъезд с замедлением (ease-out).
    const ct = Math.min(1, realT.current / CAM_DUR)
    const e = 1 - (1 - ct) * (1 - ct)
    camera.position.set(0, 1.7, CAM_Z0 + (CAM_Z1 - CAM_Z0) * e)
    camera.lookAt(0, CENTER_Y, 0)

    const a = sides[0], b = sides[1]
    _cA.set(a.x, CENTER_Y, 0); _cB.set(b.x, CENTER_Y, 0)
    // Шары смотрят друг на друга.
    a.body.faceDir(_dir.set(b.x - a.x, 0, 0).normalize())
    b.body.faceDir(_dir.set(a.x - b.x, 0, 0).normalize())
    a.body.tickShader(dt); b.body.tickShader(dt)

    if (!fired.current) {
      // Заряд: windup-FX по стилю обоих.
      const p = Math.min(1, localT.current / CHARGE_DUR)
      for (const [side, center, target] of [[a, _cA, _cB], [b, _cB, _cA]] as const) {
        windupFrame.progress = p
        windupFrame.shrink = 1
        windupFrame.baseColor = side.color
        windupFrame.aimDir.copy(target).sub(center).normalize()
        windupFrame.origin.copy(center)
        side.windup.apply(dt, { mesh: side.body.mesh, material: side.body.material }, windupFrame)
      }
      if (localT.current >= CHARGE_DUR) {
        fired.current = true
        _endA.lerpVectors(_cA, _cB, BEAM_REACH)   // луч A долетает до 46% (ещё в полёте)
        _endB.lerpVectors(_cB, _cA, BEAM_REACH)
        a.beam.playBeam(_cA, _endA); a.beam.update(dt, ctx.current)
        b.beam.playBeam(_cB, _endB); b.beam.update(dt, ctx.current)
        onSfx('beam_fire_rage'); onSfx('beam_fire_singularity')
      }
    } else {
      // После выстрела время почти стоит: лучи «висят» в полёте.
      const slow = dt * SLOWMO_HOLD
      a.beam.update(slow, ctx.current)
      b.beam.update(slow, ctx.current)
    }

    if (realT.current >= FINALE_DUR) { ended.current = true; onEnd() }
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[4, 8, 6]} intensity={1.1} />
      {sides.map(s => (
        <group key={s.x}>
          <primitive object={s.body.object3d} />
          <primitive object={s.windup.object3d} />
          <primitive object={s.beam.object3d} />
        </group>
      ))}
      <EffectComposer frameBufferType={THREE.HalfFloatType}>
        <Bloom intensity={1.2} luminanceThreshold={0.2} luminanceSmoothing={0.6} radius={0.7} mipmapBlur />
      </EffectComposer>
    </>
  )
}
