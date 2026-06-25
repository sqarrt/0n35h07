import { useRef, useMemo, useEffect, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { BALL_RADIUS, BODY_MESH_Y, PREVIEW_SPIN_SPEED, HOST_ID, OPPONENT_ID, MENU_ANIM_TAU, BEAM_WINDUP, WINDUP_SHRINK_MS, DASH_SPEED, DASH_DURATION } from '../constants'
import type { BallModel, WindupStyle, RespawnStyle, DashStyle, ShieldStyle } from '../constants'
import type { RoomView } from '../net/RoomSession'
import { PLAYER_SPOT, OPPONENT_SPOT, cameraStateFor } from './menuStage'
import type { MenuMode, AppearancePart, MenuCameraState, CameraPoses, CameraPose } from './menuStage'
import rawPoses from './menuCameraPoses.json'
import { Body } from '../game/Body'
import { decodeBallArt } from '../game/ballArt'
import type { AudioAnalysis } from '../game/audio/AudioAnalysis'
import { MenuEdgeGlow, MENU_GLOW_LAYER } from './MenuEdgeGlow'
import { RadioTakeover } from './radioTakeover/RadioTakeover'
import { createWindupFx } from '../game/fx/windup/createWindupFx'
import { BeamWeapon } from '../game/BeamWeapon'
import { createBeamFx } from '../game/fx/beam/createBeamFx'
import { createRespawnFx } from '../game/fx/respawn/createRespawnFx'
import { createDashFx } from '../game/fx/dash/createDashFx'
import { createShieldFx } from '../game/fx/shield/createShieldFx'
import type { WeaponContext } from '../game/abstractions'
import type { World } from '../game/World'
import { windupSfxEvent } from '../game/audio/sfx/windupSfx'
import type { ISfxEngine } from '../game/audio/sfx/types'

export type { MenuMode } from './menuStage'

// Camera / model-appearance animation.
const DAMP_TAU = MENU_ANIM_TAU // camera move — shared TAU with the menu backdrop (same speed)
const FADE_TAU = 0.13          // model appearance (opacity) — soft fade (~0.4s)
const COLOR_TAU = 0.067        // smooth model color change (~0.2s to 95%)
const EXIT_MS = 400            // how long we keep the leaving ball mounted while it fades out
const WARMUP_FRAMES = 4        // warmup frames (shader compilation behind an invisible ball) before the fade starts
const GLOW_MOUNT_DELAY_MS = 600 // deferred glow-composer mount (see comment in MenuBackdrop)

// Charge animation preview — on the appearance screen: a one-shot run per click (charge → fire → idle).
const PREVIEW_CHARGE_MS = BEAM_WINDUP        // charge — same as the player's
const PREVIEW_FIRE_MS = WINDUP_SHRINK_MS     // "deflation" after the shot
const PREVIEW_BEAM_LEN = BALL_RADIUS * 16    // preview shot beam length (world units)
const PREVIEW_ENTITY_ID = -1                 // entityId of the preview Body (its hitbox is excluded from combat)
// Cosmetic context for the preview BeamWeapon: the weapon phase is always idle → fire()/raycast are never called.
const PREVIEW_BEAM_CTX: WeaponContext = {
  world: { raycast: () => null } as unknown as World,
  muzzle: new THREE.Vector3(), aim: new THREE.Vector3(0, 0, -1), excludeIds: [],
}

// SHOT block: the aim is fixed — diagonal (the model turns via faceDir as in the game).
const SHOT_AIM_DIR = new THREE.Vector3(-0.78, -0.55, 1.3).normalize()

// Respawn preview: a single run per click — death → ghost (run around a circle) → rebirth.
const RESPAWN_PREVIEW_GHOST_MS = 1200
const RESPAWN_PREVIEW_REBIRTH_MS = 500
const RESPAWN_CIRCLE_R = 2.6     // ghost-run radius (world units — "playing as the bot")

// Dash preview: a dash sideways and back ("playing as the model" — sanctioned movement #2);
// at the end a HARD snap to the spot (position.copy(spot) every frame, offset only in active phases).
const DASH_PREVIEW_MS = DASH_DURATION                          // each dash duration — same as in-game
const DASH_PREVIEW_DIST = DASH_SPEED * DASH_DURATION / 1000    // honest in-game dash distance
const DASH_PREVIEW_PAUSE_MS = 350                              // pause between "out" and "back"

// Shield preview: the skin turns on for a while and fades (shield_up/shield_down sounds).
const SHIELD_PREVIEW_MS = 1500

// Camera fly (dev, J held): mouse — look, wheel — forward/back. On release the pose is written to a file.
const FLY_KEY = 'KeyJ'
const FLY_LOOK_SENS = 0.0032     // rad per mouse pixel
const FLY_WHEEL_STEP = 0.0012    // units per wheel deltaY unit
const FLY_TARGET_DIST = 4        // distance to the saved look point (along the camera ray)
const POSES_ENDPOINT = '/__camera-poses'

// Per-frame scratch objects (no allocations).
const _beamEnd = new THREE.Vector3()
const _meshCenter = new THREE.Vector3()
const _camPosT = new THREE.Vector3()
const _camLookT = new THREE.Vector3()
const _flyDir = new THREE.Vector3()
const _tangent = new THREE.Vector3()

// Camera poses: a module-level copy from JSON; fly (J) edits are written here and to a file via a dev endpoint.
const poses: CameraPoses = JSON.parse(JSON.stringify(rawPoses)) as CameraPoses
// Fly active → CameraRig doesn't touch the camera. A module flag — FlyCam and CameraRig live in the same Canvas.
const flying = { current: false }

// ringColor — the "secondary" color (planet ring); *Seq — click counters (one-shot preview triggers).
interface BallSpec { color: string; model: BallModel; ringColor?: string; windupStyle?: WindupStyle; windupSeq?: number; respawnStyle?: RespawnStyle; respawnSeq?: number; dashStyle?: DashStyle; dashSeq?: number; shieldStyle?: ShieldStyle; shieldSeq?: number; ballArt?: string }
interface ActiveBall { key: string; spec: BallSpec; spot: THREE.Vector3 }

/** The light slowly orbits the balls — the highlight glides, the models read as "living" 3D. */
function OrbitingLight() {
  const ref = useRef<THREE.Group>(null)
  useFrame((_, dt) => { if (ref.current) ref.current.rotation.y += PREVIEW_SPIN_SPEED * dt })
  return (
    <group ref={ref}>
      <directionalLight position={[10, 10, 5]} intensity={1} />
    </group>
  )
}

/** Camera rig: a damped move between saved state poses. While fly (J) is active — silent. */
function CameraRig({ state }: { state: MenuCameraState }) {
  const camera = useThree(s => s.camera)
  const cur = useRef<{ pos: THREE.Vector3; look: THREE.Vector3 } | null>(null)
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    const pose: CameraPose = poses[state]
    if (!cur.current) {
      cur.current = { pos: new THREE.Vector3().fromArray(pose.position), look: new THREE.Vector3().fromArray(pose.target) }
    }
    const c = cur.current
    if (flying.current) {   // fly: the user drives the camera; the rig catches up after the pose is saved
      c.pos.copy(camera.position)
      camera.getWorldDirection(_flyDir)
      c.look.copy(camera.position).addScaledVector(_flyDir, FLY_TARGET_DIST)
      return
    }
    _camPosT.fromArray(pose.position)
    _camLookT.fromArray(pose.target)
    const k = 1 - Math.exp(-dt / DAMP_TAU)
    c.pos.lerp(_camPosT, k)
    c.look.lerp(_camLookT, k)
    camera.position.copy(c.pos)
    camera.lookAt(c.look)
  })
  return null
}

/** Dev camera fly: hold J — mouse looks around, wheel moves forward/back; release —
 *  the current state's pose is saved to menuCameraPoses.json (vite-plugin-camera-poses).
 *  The subscription is ONE-TIME (state via ref): re-subscribing on a state change broke the J hold. */
function FlyCam({ state }: { state: MenuCameraState }) {
  const camera = useThree(s => s.camera)
  const stateRef = useRef(state)
  useEffect(() => { stateRef.current = state }, [state])
  useEffect(() => {
    const euler = new THREE.Euler(0, 0, 0, 'YXZ')
    const dir = new THREE.Vector3()
    const onKeyDown = (e: KeyboardEvent) => { if (e.code === FLY_KEY && !e.repeat) flying.current = true }
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code !== FLY_KEY) return
      flying.current = false
      // Save the current state's pose: position + look point along the camera ray.
      camera.getWorldDirection(dir)
      poses[stateRef.current] = {
        position: [camera.position.x, camera.position.y, camera.position.z],
        target: [
          camera.position.x + dir.x * FLY_TARGET_DIST,
          camera.position.y + dir.y * FLY_TARGET_DIST,
          camera.position.z + dir.z * FLY_TARGET_DIST,
        ],
      }
      void fetch(POSES_ENDPOINT, { method: 'PUT', body: JSON.stringify(poses, null, 2) })
        .catch(() => { /* dev endpoint unavailable (prod) — the pose stays in memory only */ })
    }
    const onMouseMove = (e: MouseEvent) => {
      if (!flying.current) return
      euler.setFromQuaternion(camera.quaternion)
      euler.y -= e.movementX * FLY_LOOK_SENS
      euler.x -= e.movementY * FLY_LOOK_SENS
      euler.x = Math.max(-Math.PI / 2 + 0.01, Math.min(Math.PI / 2 - 0.01, euler.x))
      camera.quaternion.setFromEuler(euler)
    }
    const onWheel = (e: WheelEvent) => {
      if (!flying.current) return
      camera.getWorldDirection(dir)
      camera.position.addScaledVector(dir, -e.deltaY * FLY_WHEEL_STEP)
    }
    const onBlur = () => { flying.current = false }   // window lost focus — keyup may not have arrived
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('mousemove', onMouseMove)
    window.addEventListener('wheel', onWheel, { passive: true })
    window.addEventListener('blur', onBlur)
    return () => {
      flying.current = false
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('mousemove', onMouseMove)
      window.removeEventListener('wheel', onWheel)
      window.removeEventListener('blur', onBlur)
    }
  }, [camera])
  return null
}

/**
 * The player on the menu backdrop scene: a REAL in-game Body at full size, standing on its spot.
 * No manual moves/scaling — the camera builds the frame (CameraRig). The one ruled exception:
 * the respawn preview "plays as the model" (ghost run around a circle). Appearance/exit — fade.
 */
function StageBall({ spec, spot, exiting = false, hold = false, sfx, part = 'color' }: { spec: BallSpec; spot: THREE.Vector3; exiting?: boolean; hold?: boolean; sfx?: ISfxEngine; part?: AppearancePart }) {
  const rootRef = useRef<THREE.Group>(null)
  // Real in-game Body (mesh + ring + faceDir): recreated only on model change, colors are lerped per frame.
  const body = useMemo(() => {
    const b = new Body(PREVIEW_ENTITY_ID, spec.color, spec.model, spec.ringColor ?? spec.color, decodeBallArt(spec.ballArt) ?? undefined)
    b.material.opacity = 0   // no flash before the first frame
    b.object3d.position.copy(spot)
    return b
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [spec.model])
  useEffect(() => () => body.dispose(), [body])
  // Live in-place art update (no Body/material recreation) — the player draws on the "Appearance" screen.
  useEffect(() => { body.setArt(spec.ballArt ? decodeBallArt(spec.ballArt) : null) }, [body, spec.ballArt])
  // Model → onto the glow layer (MenuEdgeGlow depth pass); enable depthWrite on the ring for the outline.
  useEffect(() => {
    rootRef.current?.traverse(o => o.layers.enable(MENU_GLOW_LAYER))
    const ringMesh = body.ringMesh
    if (ringMesh) (ringMesh.material as { depthWrite: boolean }).depthWrite = true
  }, [body])

  const isPreview = part !== undefined && spot === PLAYER_SPOT   // preview cycles — only on your own ball
  const fx = useMemo(() => (isPreview && spec.windupStyle ? createWindupFx(spec.windupStyle) : null),
    [isPreview, spec.windupStyle])
  useEffect(() => () => fx?.dispose(), [fx])
  // Preview shot beam — the same BeamWeapon as in a match (cosmetic playBeam), with the style visual.
  const beam = useMemo(() => (isPreview ? new BeamWeapon({ beamFx: createBeamFx(spec.windupStyle ?? 'classic', spec.color) }) : null),
    [isPreview, spec.color, spec.windupStyle])
  useEffect(() => () => beam?.dispose(), [beam])
  const cycle = useRef({ phase: 'idle' as 'charge' | 'fire' | 'idle', elapsed: 0 })
  // Preview click counters are monotonic and live in App: we react only to their CHANGES after mount.
  const lastSeqRef = useRef(spec.windupSeq ?? 0)
  useEffect(() => {
    if (!fx) { if (spec.windupSeq !== undefined) lastSeqRef.current = spec.windupSeq; return }
    const seq = spec.windupSeq ?? 0
    if (seq !== 0 && seq !== lastSeqRef.current) {
      lastSeqRef.current = seq
      cycle.current = { phase: 'charge', elapsed: 0 }   // one-shot run: charge → fire → idle
      sfx?.play2D(windupSfxEvent(spec.windupStyle, sfx))   // style sound — once at the start of the charge
    } else {
      cycle.current = { phase: 'idle', elapsed: 0 }
    }
  }, [fx, spec.windupSeq, spec.windupStyle, sfx])

  // Respawn preview — strategy by style; a one-shot run per click (same pattern as the shot).
  const rfx = useMemo(() => (isPreview ? createRespawnFx(spec.respawnStyle ?? 'echo', spec.color) : null),
    [isPreview, spec.respawnStyle, spec.color])
  // Mesh neutral at Body creation time (local position of the sphere center relative to the eyes).
  const meshHome = useMemo(() => body.mesh.position.clone(), [body])
  useEffect(() => {
    if (!rfx) return
    return () => {
      rfx.dispose()
      // A strategy swap may interrupt the cycle mid-phase: CHAOS moves the mesh's local position
      // (jitter) and restores it only on its own exit frame, SWARM hides the mesh. Without
      // neutralizing, the residual offset accumulates — the ball (and the centered shield dome) drift.
      body.mesh.position.copy(meshHome)
      body.mesh.scale.setScalar(1)
      body.mesh.visible = true
    }
  }, [rfx, body, meshHome])
  const respawnCycle = useRef({ phase: 'idle' as 'ghost' | 'rebirth' | 'idle', elapsed: 0 })
  const lastRespawnSeqRef = useRef(spec.respawnSeq ?? 0)
  useEffect(() => {
    if (!rfx) { if (spec.respawnSeq !== undefined) lastRespawnSeqRef.current = spec.respawnSeq; return }
    const seq = spec.respawnSeq ?? 0
    if (seq !== 0 && seq !== lastRespawnSeqRef.current) {
      lastRespawnSeqRef.current = seq
      respawnCycle.current = { phase: 'ghost', elapsed: 0 }
      _meshCenter.copy(spot).y += BODY_MESH_Y
      rfx.onDeath(_meshCenter)                           // scatter/burst from the ball's center
      sfx?.play2D('death')
    } else {
      respawnCycle.current = { phase: 'idle', elapsed: 0 }
    }
  }, [rfx, spec.respawnSeq, spec.respawnStyle, sfx, spot])
  const respawnFrameRef = useRef<{ ghost: number | null; sinceRebirthMs: number; baseColor: THREE.Color; origin: THREE.Vector3; visible: boolean } | null>(null)
  // Style DASH trail (dashStyle skin); the ghost trail is drawn by the respawn strategy itself (rfx).
  const trail = useMemo(() => (isPreview ? createDashFx(spec.dashStyle ?? 'streak', spec.color) : null),
    [isPreview, spec.dashStyle, spec.color])
  useEffect(() => () => trail?.dispose(), [trail])

  // Dash preview: a one-shot run per click — dash out → pause → dash back (seq pattern).
  const dashCycle = useRef({ phase: 'idle' as 'out' | 'pause' | 'back' | 'idle', elapsed: 0 })
  const lastDashSeqRef = useRef(spec.dashSeq ?? 0)
  useEffect(() => {
    if (!trail) { if (spec.dashSeq !== undefined) lastDashSeqRef.current = spec.dashSeq; return }
    const seq = spec.dashSeq ?? 0
    if (seq !== 0 && seq !== lastDashSeqRef.current) {
      lastDashSeqRef.current = seq
      dashCycle.current = { phase: 'out', elapsed: 0 }
      sfx?.play2D('dash')   // dash sound — at the start of each dash (the second one on "back")
    } else {
      dashCycle.current = { phase: 'idle', elapsed: 0 }
    }
  }, [trail, spec.dashSeq, spec.dashStyle, sfx])

  // Shield preview: skin by style, enabled for SHIELD_PREVIEW_MS on click (seq pattern).
  const shieldFx = useMemo(() => {
    if (!isPreview) return null
    const f = createShieldFx(spec.shieldStyle ?? 'dome')
    f.object3d.visible = false
    return f
  }, [isPreview, spec.shieldStyle])
  useEffect(() => () => shieldFx?.dispose(), [shieldFx])
  const shieldCycle = useRef({ active: false, elapsed: 0 })
  const lastShieldSeqRef = useRef(spec.shieldSeq ?? 0)
  useEffect(() => {
    if (!shieldFx) { if (spec.shieldSeq !== undefined) lastShieldSeqRef.current = spec.shieldSeq; return }
    const seq = spec.shieldSeq ?? 0
    if (seq !== 0 && seq !== lastShieldSeqRef.current) {
      lastShieldSeqRef.current = seq
      shieldCycle.current = { active: true, elapsed: 0 }
      sfx?.play2D('shield_up')
    } else {
      shieldCycle.current = { active: false, elapsed: 0 }
    }
  }, [shieldFx, spec.shieldSeq, spec.shieldStyle, sfx])

  const dampedColorRef = useRef<THREE.Color | null>(null)
  const aimDirRef = useRef<THREE.Vector3 | null>(null)
  const frameRef = useRef<{ progress: number; shrink: number; baseColor: THREE.Color; aimDir: THREE.Vector3; origin: THREE.Vector3; visible: boolean } | null>(null)
  const opacityRef = useRef(0)
  const camera = useThree(s => s.camera)

  const targetColor = useMemo(() => new THREE.Color(spec.color), [spec.color])
  const targetRingColor = useMemo(() => new THREE.Color(spec.ringColor ?? spec.color), [spec.ringColor, spec.color])

  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.1)
    // Lazy init of mutable helper objects — outside of render.
    if (!dampedColorRef.current) dampedColorRef.current = new THREE.Color(spec.color)
    if (!aimDirRef.current) aimDirRef.current = new THREE.Vector3()
    const dampedColor = dampedColorRef.current
    const aimDir = aimDirRef.current

    // Warmup: the model is invisible while shaders compile (the freeze hides behind opacity 0).
    if (hold) {
      body.material.color.copy(targetColor)
      dampedColor.copy(targetColor)
      body.setOpacity(0)
      body.setRingColor(targetRingColor)
      body.tickShader(dt)
      return
    }
    const kf = 1 - Math.exp(-dt / FADE_TAU)
    const kc = 1 - Math.exp(-dt / COLOR_TAU)
    opacityRef.current += ((exiting ? 0 : 1) - opacityRef.current) * kf
    dampedColor.lerp(targetColor, kc)
    if (!fx) body.material.color.copy(dampedColor)   // without a preview we own the color ourselves
    body.setOpacity(opacityRef.current)
    body.lerpRingColor(targetRingColor, kc)
    body.tickShader(dt)

    // Position: the model stands on the spot; in the preview ghost — a run around a circle ("playing as the bot").
    // SANCTIONED manual action: when the run ends the ball is PLACED on the default spot
    // (copy(spot) every frame) — the run need not perfectly close the circle, rebirth is always in place.
    const rc = respawnCycle.current
    body.object3d.position.copy(spot)
    let ghostRun = false
    if (rfx && rc.phase === 'ghost') {
      // theta is clamped to a full circle: a ragged frame at the phase end won't overrun the start point.
      const theta = Math.min(rc.elapsed / RESPAWN_PREVIEW_GHOST_MS, 1) * 2 * Math.PI
      body.object3d.position.x += Math.sin(theta) * RESPAWN_CIRCLE_R
      body.object3d.position.z += (Math.cos(theta) - 1) * RESPAWN_CIRCLE_R
      // Runs "facing forward" — along the circle tangent.
      _tangent.set(Math.cos(theta), 0, -Math.sin(theta))
      body.faceDir(_tangent)
      ghostRun = true
    }

    // Dash preview: offset along +X in active phases; idle → the ball is already snapped via copy(spot) above.
    // The ghost run takes priority (part = last click, but we guard against overlapping cycles).
    const dc = dashCycle.current
    let dashMove = false
    if (!ghostRun && dc.phase !== 'idle') {
      dc.elapsed += dt * 1000
      if (dc.phase === 'out' && dc.elapsed >= DASH_PREVIEW_MS) { dc.phase = 'pause'; dc.elapsed = 0 }
      else if (dc.phase === 'pause' && dc.elapsed >= DASH_PREVIEW_PAUSE_MS) {
        dc.phase = 'back'; dc.elapsed = 0
        sfx?.play2D('dash')
      }
      else if (dc.phase === 'back' && dc.elapsed >= DASH_PREVIEW_MS) { dc.phase = 'idle'; dc.elapsed = 0 }
      let off = 0
      if (dc.phase === 'out') off = DASH_SPEED * dc.elapsed / 1000
      else if (dc.phase === 'pause') off = DASH_PREVIEW_DIST
      else if (dc.phase === 'back') off = DASH_PREVIEW_DIST - DASH_SPEED * dc.elapsed / 1000
      body.object3d.position.x += Math.max(0, Math.min(off, DASH_PREVIEW_DIST))
      if (dc.phase === 'out' || dc.phase === 'back') {
        _tangent.set(dc.phase === 'out' ? 1 : -1, 0, 0)   // "facing" the dash direction
        body.faceDir(_tangent)
        dashMove = true
      }
    }

    if (!ghostRun && !dashMove) {
      if (isPreview && (part === 'paintFront' || part === 'paintBack')) {
        aimDir.set(0, 0, 1)   // ART: the front hemisphere faces +Z; the camera (front/back) shows the right side
      } else {
        aimDir.copy(camera.position).sub(body.object3d.position).normalize()   // by default — "facing" the viewer
        if (isPreview && part === 'shot') aimDir.copy(SHOT_AIM_DIR)            // SHOT: a fixed diagonal
      }
      body.faceDir(aimDir)
    }
    _meshCenter.copy(body.object3d.position).y += BODY_MESH_Y   // sphere center (world)

    // Shield preview: the skin rides with the ball (mesh center), animates as active, fades on a timer.
    if (shieldFx) {
      const sc = shieldCycle.current
      if (sc.active) {
        sc.elapsed += dt * 1000
        if (sc.elapsed >= SHIELD_PREVIEW_MS) {
          sc.active = false
          shieldFx.object3d.visible = false
          sfx?.play2D('shield_down')
        } else {
          shieldFx.object3d.visible = true
          shieldFx.object3d.position.copy(_meshCenter)
          shieldFx.update(dt, true)
        }
      } else {
        shieldFx.object3d.visible = false
      }
    }

    // One-shot charge preview on click: charge → fire → idle.
    if (fx) {
      if (!frameRef.current) {
        frameRef.current = { progress: 0, shrink: 1, baseColor: dampedColor, aimDir, origin: new THREE.Vector3(), visible: true }
      }
      const cy = cycle.current
      cy.elapsed += dt * 1000
      if (cy.phase === 'charge' && cy.elapsed >= PREVIEW_CHARGE_MS) {
        cy.phase = 'fire'; cy.elapsed = 0
        // Shot moment: a beam from the ball's center along the aim (BeamWeapon visual — as in a match).
        _beamEnd.copy(_meshCenter).addScaledVector(aimDir, PREVIEW_BEAM_LEN)
        beam?.playBeam(_meshCenter, _beamEnd)
      }
      else if (cy.phase === 'fire' && cy.elapsed >= PREVIEW_FIRE_MS) { cy.phase = 'idle'; cy.elapsed = 0 }
      const f = frameRef.current
      f.progress = cy.phase === 'charge' ? Math.min(cy.elapsed / PREVIEW_CHARGE_MS, 1) : 0
      f.shrink = cy.phase === 'fire' ? Math.min(cy.elapsed / PREVIEW_FIRE_MS, 1) : 1
      f.aimDir.copy(aimDir)
      f.origin.copy(_meshCenter)
      fx.apply(dt, { mesh: body.mesh, material: body.material }, f)
      beam?.update(dt, PREVIEW_BEAM_CTX)   // weapon phase idle → only beam/afterglow render
    }

    // Respawn preview: ghost (run) → rebirth → idle. The respawn sound — at the start of reassembly.
    if (rfx) {
      if (!respawnFrameRef.current) {
        respawnFrameRef.current = { ghost: null, sinceRebirthMs: Number.MAX_SAFE_INTEGER, baseColor: dampedColor, origin: new THREE.Vector3(), visible: true }
      }
      const rf = respawnFrameRef.current
      rc.elapsed += dt * 1000
      if (rc.phase === 'ghost' && rc.elapsed >= RESPAWN_PREVIEW_GHOST_MS) {
        rc.phase = 'rebirth'; rc.elapsed = 0
        sfx?.play2D('respawn')
      } else if (rc.phase === 'rebirth' && rc.elapsed >= RESPAWN_PREVIEW_REBIRTH_MS) {
        rc.phase = 'idle'; rc.elapsed = 0
      }
      if (rc.phase === 'ghost') {
        rf.ghost = 1 - rc.elapsed / RESPAWN_PREVIEW_GHOST_MS
        rf.sinceRebirthMs = Number.MAX_SAFE_INTEGER
      } else {
        rf.ghost = null
        rf.sinceRebirthMs = rc.phase === 'rebirth' ? rc.elapsed : Number.MAX_SAFE_INTEGER
      }
      rf.origin.copy(_meshCenter)   // the swarm circles around the running ball
      rfx.apply(dt, {
        mesh: body.mesh, material: body.material,
        setOpacity: (o: number) => body.setOpacity(o),
      }, rf)
      rfx.update(dt)
    }

    // As in a match: the style trail is dash-only; the ghost trail is drawn by rfx inside apply.
    trail?.update(dt, { position: body.object3d.position, dashing: dashMove })
  })

  return (
    <group ref={rootRef}>
      <primitive object={body.object3d} />
      {fx && <primitive object={fx.object3d} />}
      {beam && <primitive object={beam.object3d} />}
      {rfx && <primitive object={rfx.object3d} />}
      {trail && <primitive object={trail.object3d} />}
      {shieldFx && <primitive object={shieldFx.object3d} />}
    </group>
  )
}

const specOf = (color: string, model?: BallModel, ringColor?: string): BallSpec => ({ color, model: model ?? 'smooth', ringColor })

/** Who stands on the scene: your own player — always on its spot; in a room with an opponent — the second on the neighboring one. */
function computeBalls(mode: MenuMode, player: BallSpec, room: RoomView | null): ActiveBall[] {
  if (mode === 'lobby' && room) {
    const host = room.roster.find(r => r.id === HOST_ID)
    const opp = room.roster.find(r => r.id === OPPONENT_ID)
    if (host && opp) {
      const selfIsHost = room.localPlayerId === HOST_ID
      const self = selfIsHost ? host : opp
      const other = selfIsHost ? opp : host
      return [
        { key: 'player', spec: specOf(self.color, self.ballModel, player.ringColor), spot: PLAYER_SPOT },
        { key: 'other', spec: specOf(other.color, other.ballModel), spot: OPPONENT_SPOT },
      ]
    }
    if (host) return [{ key: 'player', spec: specOf(host.color, host.ballModel, player.ringColor), spot: PLAYER_SPOT }]
  }
  return [{ key: 'player', spec: player, spot: PLAYER_SPOT }]
}

type RenderedBall = ActiveBall & { exiting?: boolean }

/** Signature of active balls — a stable effect dependency (computeBalls returns new objects every render). */
function signOf(balls: ActiveBall[]): string {
  return balls.map(b => `${b.key}:${b.spec.color}:${b.spec.ringColor ?? ''}:${b.spec.model}:${b.spec.windupStyle ?? ''}:${b.spec.windupSeq ?? 0}:${b.spec.respawnStyle ?? ''}:${b.spec.respawnSeq ?? 0}:${b.spec.dashStyle ?? ''}:${b.spec.dashSeq ?? 0}:${b.spec.shieldStyle ?? ''}:${b.spec.shieldSeq ?? 0}:${b.spec.ballArt ?? ''}`).join('|')
}

function Scene({ mode, player, room, appearancePart = 'color', onReady, sfx }: { mode: MenuMode; player: BallSpec; room: RoomView | null; appearancePart?: AppearancePart; onReady?: () => void; sfx?: ISfxEngine }) {
  const active = computeBalls(mode, player, room)
  const sign = signOf(active)
  const [rendered, setRendered] = useState<RenderedBall[]>(active)
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  // Scene warmup: in the first frames the model shaders and post-process composer compile (freeze). Keep the balls
  // invisible (hold) until that passes, then allow the fade — the appearance comes out smooth, without a jerk.
  const [warm, setWarm] = useState(false)
  const warmFrames = useRef(0)
  const firedReady = useRef(false)
  useFrame(() => {
    if (warmFrames.current >= WARMUP_FRAMES) return
    warmFrames.current += 1
    if (warmFrames.current >= WARMUP_FRAMES) {
      setWarm(true)
      // Context created and a few frames drawn → safe to overlay (no init race).
      if (!firedReady.current) { firedReady.current = true; onReady?.() }
    }
  })

  useEffect(() => {
    const activeKeys = new Set(active.map(b => b.key))
    setRendered(prev => {
      const next: RenderedBall[] = active.map(b => ({ ...b }))   // active — without exiting
      for (const b of prev) {
        if (activeKeys.has(b.key)) {                              // returned to active → cancel exit
          const tm = timers.current.get(b.key)
          if (tm) { clearTimeout(tm); timers.current.delete(b.key) }
          continue
        }
        next.push({ ...b, exiting: true })                       // gone → keep while it fades out
        if (!timers.current.has(b.key)) {
          const tm = setTimeout(() => {
            timers.current.delete(b.key)
            setRendered(r => r.filter(x => x.key !== b.key))
          }, EXIT_MS)
          timers.current.set(b.key, tm)
        }
      }
      return next
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sign])

  useEffect(() => () => { timers.current.forEach(clearTimeout); timers.current.clear() }, [])

  return (
    <>
      {rendered.map(b => <StageBall key={b.key} spec={b.spec} spot={b.spot} exiting={b.exiting} hold={!warm} sfx={sfx} part={appearancePart} />)}
    </>
  )
}

// Dev floor grid — shown ONLY while flying (J held), so the regular menu has no debug grid. Toggled by the
// shared `flying` flag each frame (a module flag, not React state → flip `.visible` directly, no re-render).
function DebugGrid() {
  const ref = useRef<THREE.GridHelper>(null)
  useFrame(() => { if (ref.current) ref.current.visible = flying.current })
  return <gridHelper ref={ref} args={[24, 24, '#2a3550', '#141d33']} visible={false} />
}

// React context doesn't cross the R3F Canvas boundary — so the engine comes as a prop, not via useSfx().
// radioMode (≠ undefined) turns the backdrop into the full-screen Radio "takeover": amplified frosted-glass
// glow + music-reactive bloom, camera dolly/shake, emoji rain and in-scene Strudel code. Implemented in a
// dedicated in-Canvas component; the prop carries the current track's code + mood for those visuals.
interface MenuBackdropProps { mode: MenuMode; player: BallSpec; room?: RoomView | null; appearancePart?: AppearancePart; analysis?: AudioAnalysis; glow?: boolean; glowMuted?: boolean; radioMode?: { code: string; mood: string }; onReady?: () => void; sfx?: ISfxEngine }

/**
 * Persistent transparent backdrop for menu screens: a real scene with the player (Body at full size,
 * standing on a spot; in a room — two). The frame is built ONLY by the camera (CameraRig, poses from menuCameraPoses.json);
 * the only "game" movement is the ghost run in the respawn preview. Dev: floor grid + fly via J.
 */
export function MenuBackdrop({ mode, player, room, appearancePart, analysis, glow = true, glowMuted = false, radioMode, onReady, sfx }: MenuBackdropProps) {
  // The heavy glow composer (Bloom + edge-effect + depth-pass) SYNCHRONOUSLY compiles its shaders on the first
  // render — this blocks the main thread (whole-UI freeze) and "eats" the ball fade. So we mount it NOT on the
  // critical entry path but with a delay: by then the ball has already appeared, and the glow in silence is still 0
  // (music is only starting to fade in) — compilation passes unnoticed. requestIdleCallback — in a free slot.
  const [glowReady, setGlowReady] = useState(false)
  useEffect(() => {
    if (!glow) { setGlowReady(false); return }
    const w = window as Window & { requestIdleCallback?: (cb: () => void) => number; cancelIdleCallback?: (id: number) => void }
    let idle = 0
    const t = setTimeout(() => {
      if (w.requestIdleCallback) idle = w.requestIdleCallback(() => setGlowReady(true))
      else setGlowReady(true)
    }, GLOW_MOUNT_DELAY_MS)
    return () => { clearTimeout(t); if (idle && w.cancelIdleCallback) w.cancelIdleCallback(idle) }
  }, [glow])

  // Dev: pull FRESH poses from the endpoint — the file is excluded from the watcher, and Vite's module cache
  // may hand a new tab stale JSON (J edits from another tab would otherwise be invisible).
  useEffect(() => {
    if (!import.meta.env.DEV) return
    void fetch(POSES_ENDPOINT)
      .then(r => (r.ok ? r.json() : null))
      .then((fresh: CameraPoses | null) => { if (fresh) Object.assign(poses, fresh) })
      .catch(() => { /* no endpoint (preview build) — we stay on the imported poses */ })
  }, [])

  const hasOpponent = !!room?.roster.find(r => r.id === OPPONENT_ID)
  const isClient = room != null && room.localPlayerId !== HOST_ID   // joined someone else's room
  const camState = cameraStateFor(mode, hasOpponent, isClient, appearancePart ?? 'color')

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
      <Canvas gl={{ alpha: true }} dpr={[1, 2]} camera={{ position: poses.default.position, fov: 45 }}
        onCreated={({ camera }) => camera.lookAt(...poses.default.target)}>
        <ambientLight intensity={0.4} />
        <OrbitingLight />
        <CameraRig state={camState} />
        {import.meta.env.DEV && <FlyCam state={camState} />}
        {/* Debug floor — visible only while flying (J held); the menu stays clean when nobody moves the camera. Dev-only. */}
        {import.meta.env.DEV && <DebugGrid />}
        <Scene mode={mode} player={player} room={room ?? null} appearancePart={appearancePart} onReady={onReady} sfx={sfx} />
        {/* Radio takeover: while a track is on the Radio screen the backdrop becomes a full-screen visualizer —
            soft frosted-glass bloom + camera dolly/shake + emoji rain + in-scene Strudel code. Its own (soft) Bloom
            composer renders instead of MenuEdgeGlow's (sharp) one — only ONE composer runs at a time. */}
        {radioMode && <RadioTakeover radioMode={radioMode} analysis={analysis} />}
        {/* Glow on the VISIBLE model edges (principle like block highlighting) → Bloom; in silence there's no glow.
            Mounted deferred (see above) so compilation doesn't freeze entry. The settings toggle is the external gate.
            Suppressed during the radio takeover (its soft bloom replaces this sharp one — never two composers). */}
        {!radioMode && glow && glowReady && <MenuEdgeGlow analysis={analysis} muted={glowMuted} />}
      </Canvas>
    </div>
  )
}
