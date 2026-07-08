import { useMemo, useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { VOXEL, cellKey, parseCellKey, shapeBlock } from './editorStore'
import type { Cell, BlockType, Dir } from './editorStore'
import { regionBounds, canStamp } from './editorSelection'
import type { Fragment } from './editorSelection'
import type { Vec3 } from '../game/maps'
import { GRAVITY, JUMP_FORCE, EYE_HEIGHT, BLOCK_TRANSPARENT_OPACITY } from '../constants'
import { unitWedgeGeometry, wedgeRotationY } from '../game/wedge'
import { gridGeometry } from '../game/grid'
import { cellCenter, cellsGridGeometry, BLOCK_GRID_COLOR, BLOCK_GRID_OPACITY } from '../game/blockGrid'
import { MapLights } from '../components/MapVisualBits'
import { MapEdges, BLOCK_LAYER } from '../components/EdgeOutline'
import { loadProfile } from '../settings'

const REACH = 14
const WALK_SPEED = 6.5
const AUTOCLICK_MS = 110      // hold LMB/RMB to auto-repeat place/remove at the crosshair (like fast clicking)
const PLAYER_R = 0.3          // player's horizontal half-size (for collision in walk mode)
const WALL_HALF = 0.25        // half-thickness of the perimeter wall (as in editor walls)
// Spawn marker — a vertical cylinder fading to transparent toward the top (host / guest differ by color).
// Center snaps to the half-grid (step VOXEL/2): lands both on a cell center and on a grid-line intersection.
const SPAWN_CYL_R = 0.4
const SPAWN_CYL_H = 2.4
const SPAWN_SNAP = VOXEL / 2
const snapHalf = (v: number) => Math.round(v / SPAWN_SNAP) * SPAWN_SNAP
const SPAWN_COLORS = ['#4af', '#fa4'] as const
const GHOST_COLOR = '#4af'            // ghost установки/выделения
const GHOST_INVALID_COLOR = '#f66'    // ghost вставки при пересечении/выходе за арену
const GHOST_OPACITY = 0.35            // прозрачность ghost-мешей установки/вставки
const SELECT_BOX_OPACITY = 0.18       // полупрозрачный бокс выделения

type CellCoord = [number, number, number]
// Hotbar tool: a block type or placing a spawn (host=0 / guest=1).
export type EditorTool = BlockType | 'spawn0' | 'spawn1' | 'select'
const isSpawnTool = (t: EditorTool): t is 'spawn0' | 'spawn1' => t === 'spawn0' || t === 'spawn1'

// Sides for wedge auto-orientation: dir 0=+Z,1=+X,2=−Z,3=−X.
const CARDINALS: ReadonlyArray<readonly [Dir, number, number]> = [[0, 0, 1], [1, 1, 0], [2, 0, -1], [3, -1, 0]]
function dirFromFacing(fx: number, fz: number): Dir {
  let best: Dir = 0, bestDot = -Infinity
  for (const [d, cx, cz] of CARDINALS) {
    const dot = fx * cx + fz * cz
    if (dot > bestDot) { bestDot = dot; best = d }
  }
  return best
}
/** Wedge orientation on placement: low side toward the player, slope rises along the view (you step in and walk
 * up) + manual rot·90° turn (R). */
function wedgeDir(fx: number, fz: number, rot: number): Dir {
  return ((dirFromFacing(fx, fz) + rot) % 4) as Dir
}
/** One-cell step along the dominant axis of the face normal (for "flush" placement). */
function axisStep(n: THREE.Vector3): CellCoord {
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z)
  if (ax >= ay && ax >= az) return [Math.sign(n.x), 0, 0]
  if (ay >= az) return [0, Math.sign(n.y), 0]
  return [0, 0, Math.sign(n.z)]
}

// Wedge high side in world by dir (accounting for wedgeRotationY = −dir·90°): d0=+Z,1=−X,2=−Z,3=+X.
const HIGH_DIR: Record<Dir, [number, number]> = { 0: [0, 1], 1: [-1, 0], 2: [0, -1], 3: [1, 0] }
const STEP = 0.4   // max step-up height (like autostep in-game; > per-frame rise on a slope, < a cube edge)

interface Props {
  voxels: Map<string, Cell>     // a new Map on every edit → instance rebuild
  half: [number, number]
  floorColor: string
  wallColor: string
  spawns: [Vec3, Vec3]
  tool: EditorTool              // active tool (cube/wedge/spawn)
  fly: boolean                  // fly mode (no gravity/collision); false by default
  wedgeRot: number              // manual wedge turn (R) on top of auto-orientation, 90° step
  wedgeFlip: boolean            // wedge flipped on Y (T) — slope underneath
  showCubeGrid: boolean         // highlight all cell borders (L) — build mode
  color: string
  brushBeam: boolean            // brush: blocksBeam (true = beam-blocking)
  brushTransparent: boolean     // brush: translucent
  brushPassable: boolean        // brush: passable (no collider)
  selection: { a: CellCoord; b?: CellCoord } | null   // выделение: угол 1 (+ угол 2, когда зафиксирован)
  paste: Fragment | null        // не-null = режим вставки (фрагмент уже повёрнут)
  onPlace: (cell: CellCoord, data: Cell) => void
  onRemove: (cell: CellCoord) => void
  onSpawn: (idx: 0 | 1, x: number, z: number, surfaceY: number) => void
  onCorner: (cell: CellCoord) => void
  onSelectionClear: () => void
  onStamp: (anchor: CellCoord) => void
  onPasteCancel: () => void
}

/** Vertical gradient for the spawn cylinder's alphaMap: opaque bottom → transparent top. */
function useSpawnAlpha(): THREE.Texture {
  return useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 1; cv.height = 64
    const ctx = cv.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, 64)
    g.addColorStop(0, '#000')   // canvas top → cylinder top (flipY): transparent
    g.addColorStop(1, '#fff')   // bottom: opaque
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1, 64)
    return new THREE.CanvasTexture(cv)
  }, [])
}

/** Cell-outline geometry (cube borders) — edges of every occupied cell (a primitive shared with the game). */
function useEdgesGeometry(voxels: Map<string, Cell>): THREE.BufferGeometry {
  return useMemo(() => cellsGridGeometry([...voxels.keys()].map(parseCellKey)), [voxels])
}

/** Instanced cube mesh (t==='cube'); per-instance color. Rebuilt when the Map changes. */
function useCubeMeshes(voxels: Map<string, Cell>): { opaque: THREE.InstancedMesh; transparent: THREE.InstancedMesh } {
  return useMemo(() => {
    const build = (cells: [string, Cell][], transparent: boolean) => {
      const geo = new THREE.BoxGeometry(VOXEL, VOXEL, VOXEL)
      const mat = new THREE.MeshStandardMaterial(transparent ? { transparent: true, opacity: BLOCK_TRANSPARENT_OPACITY, depthWrite: false } : {})
      const mesh = new THREE.InstancedMesh(geo, mat, Math.max(cells.length, 1))
      mesh.layers.enable(BLOCK_LAYER)   // into the edge outline
      mesh.count = cells.length
      const m = new THREE.Matrix4()
      const c = new THREE.Color()
      let i = 0
      for (const [k, cell] of cells) {
        const [x, y, z] = parseCellKey(k)
        m.setPosition(...cellCenter(x, y, z))
        mesh.setMatrixAt(i, m)
        mesh.setColorAt(i, c.set(cell.c))
        i++
      }
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.castShadow = true
      mesh.receiveShadow = true
      mesh.userData.editorTarget = true
      return mesh
    }
    const cubes = [...voxels].filter(([, cell]) => cell.t === 'cube')
    return {
      opaque: build(cubes.filter(([, c]) => !c.tr), false),
      transparent: build(cubes.filter(([, c]) => c.tr), true),
    }
  }, [voxels])
}

/** Separate wedge meshes (non-cube cells). On the block layer → included in the edge outline. */
function ShapeMeshes({ voxels, wedgeGeo, wedgeGeoFlip }: { voxels: Map<string, Cell>; wedgeGeo: THREE.BufferGeometry; wedgeGeoFlip: THREE.BufferGeometry }) {
  const shapes = useMemo(() => {
    const out: { key: string; b: ReturnType<typeof shapeBlock> }[] = []
    for (const [k, cell] of voxels) {
      if (cell.t === 'cube') continue
      const [x, y, z] = parseCellKey(k)
      out.push({ key: k, b: shapeBlock(x, y, z, cell) })
    }
    return out
  }, [voxels])
  return (
    <>
      {shapes.map(({ key, b }) => (
        <mesh key={key} position={b.pos} rotation={[0, wedgeRotationY(b.dir ?? 0), 0]} geometry={b.flip ? wedgeGeoFlip : wedgeGeo}
          scale={[b.size[0] * 2, b.size[1] * 2, b.size[2] * 2]} castShadow receiveShadow
          userData={{ editorTarget: true, cellKey: key }} onUpdate={o => o.layers.enable(BLOCK_LAYER)}>
          <meshStandardMaterial color={b.color} transparent={b.transparent === true} opacity={b.transparent ? BLOCK_TRANSPARENT_OPACITY : 1} depthWrite={b.transparent !== true} />
        </mesh>
      ))}
    </>
  )
}

/** Editor scene + controls (walking with gravity + placing/removing blocks at the crosshair). */
export function EditorScene(props: Props) {
  const { voxels, half, floorColor, wallColor, spawns, tool, fly, wedgeRot, wedgeFlip, showCubeGrid, color, brushBeam, brushTransparent, brushPassable, selection, paste, onPlace, onRemove, onSpawn, onCorner, onSelectionClear, onStamp, onPasteCancel } = props
  const { camera, scene, raycaster } = useThree()
  const [hx, hz] = half

  const cubeMeshes = useCubeMeshes(voxels)
  useEffect(() => () => {
    for (const mesh of [cubeMeshes.opaque, cubeMeshes.transparent]) { mesh.geometry.dispose(); (mesh.material as THREE.Material).dispose() }
  }, [cubeMeshes])
  const wedgeGeo = useMemo(() => unitWedgeGeometry(), [])
  useEffect(() => () => wedgeGeo.dispose(), [wedgeGeo])
  const wedgeGeoFlip = useMemo(() => unitWedgeGeometry(true), [])
  useEffect(() => () => wedgeGeoFlip.dispose(), [wedgeGeoFlip])
  const edgesGeo = useEdgesGeometry(voxels)
  useEffect(() => () => edgesGeo.dispose(), [edgesGeo])
  const gridGeo = useMemo(() => gridGeometry(hx, hz), [hx, hz])
  useEffect(() => () => gridGeo.dispose(), [gridGeo])
  const postFx = useMemo(() => loadProfile().postProcessing, [])
  const spawnAlpha = useSpawnAlpha()
  useEffect(() => () => spawnAlpha.dispose(), [spawnAlpha])

  const ghostBoxRef = useRef<THREE.Mesh>(null)
  const ghostWedgeRef = useRef<THREE.Mesh>(null)
  const ghostSpawnRef = useRef<THREE.Mesh>(null)
  const selBoxRef = useRef<THREE.Mesh>(null)

  // Ghost вставки: один материал на группу — цвет валидности переключается разом.
  const pasteMat = useMemo(() => new THREE.MeshBasicMaterial({ color: GHOST_COLOR, transparent: true, opacity: GHOST_OPACITY, depthWrite: false }), [])
  useEffect(() => () => pasteMat.dispose(), [pasteMat])
  const pasteGroup = useMemo(() => {
    if (!paste) return null
    const grp = new THREE.Group()
    grp.visible = false   // позиционируется в useFrame; без этого мигнёт в начале координат
    const cubes = [...paste.cells].filter(([, cell]) => cell.t === 'cube')
    const inst = new THREE.InstancedMesh(new THREE.BoxGeometry(VOXEL, VOXEL, VOXEL), pasteMat, Math.max(cubes.length, 1))
    inst.count = cubes.length
    const m = new THREE.Matrix4()
    cubes.forEach(([k], i) => {
      const [x, y, z] = parseCellKey(k)
      m.setPosition(...cellCenter(x, y, z))
      inst.setMatrixAt(i, m)
    })
    inst.instanceMatrix.needsUpdate = true
    grp.add(inst)
    for (const [k, cell] of paste.cells) {
      if (cell.t === 'cube') continue
      const [x, y, z] = parseCellKey(k)
      const b = shapeBlock(x, y, z, cell)
      const wm = new THREE.Mesh(cell.f ? wedgeGeoFlip : wedgeGeo, pasteMat)
      wm.position.set(...b.pos)
      wm.rotation.set(0, wedgeRotationY(cell.d), 0)
      wm.scale.set(b.size[0] * 2, b.size[1] * 2, b.size[2] * 2)
      grp.add(wm)
    }
    return grp
  }, [paste, pasteMat, wedgeGeo, wedgeGeoFlip])
  // Первый ребёнок группы — InstancedMesh кубов с собственной BoxGeometry; wedge-геометрии общие, их не трогать.
  useEffect(() => () => { (pasteGroup?.children[0] as THREE.InstancedMesh | undefined)?.geometry.dispose() }, [pasteGroup])
  const keys = useRef({ f: false, b: false, l: false, r: false, jump: false })
  const vy = useRef(0)
  const grounded = useRef(false)

  // --- crosshair raycast over the scene → place/remove cell (+ hit point for spawn) ---
  const pick = (): { place: CellCoord; remove: CellCoord; point: THREE.Vector3 } | null => {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
    raycaster.far = REACH
    const targets: THREE.Object3D[] = []
    scene.traverse(o => { if ((o as THREE.Mesh).isMesh && o.userData.editorTarget) targets.push(o) })
    const hits = raycaster.intersectObjects(targets, false)
    if (!hits.length || !hits[0].face) return null
    const hit = hits[0]
    const p = hit.point
    const n = hit.face!.normal.clone().transformDirection(hit.object.matrixWorld).normalize()
    const S = VOXEL
    const toCell = (q: THREE.Vector3): CellCoord => [Math.floor(q.x / S), Math.floor(q.y / S), Math.floor(q.z / S)]
    const key = hit.object.userData.cellKey
    // Placing off a shape cell (sub-cell size breaks geometry: a face inside the cell) → step by the normal;
    // for full-size targets (cube/floor/wall) — geometrically. Removing a shape — by its cellKey.
    let place: CellCoord
    let remove: CellCoord
    if (typeof key === 'string') {
      const [bx, by, bz] = parseCellKey(key)
      const [sx, sy, sz] = axisStep(n)
      place = [bx + sx, by + sy, bz + sz]
      remove = [bx, by, bz]
    } else {
      place = toCell(p.clone().addScaledVector(n, S * 0.5))
      remove = toCell(p.clone().addScaledVector(n, -S * 0.5))
    }
    return { place, remove, point: p.clone() }
  }

  // Угол выделения под прицелом: существующий блок — его ячейка, иначе ячейка установки (пол/стена).
  const cornerOf = (c: { place: CellCoord; remove: CellCoord }): CellCoord =>
    voxels.has(cellKey(...c.remove)) ? c.remove : c.place

  useEffect(() => {
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = keys.current
      switch (e.code) {
        case 'KeyW': k.f = down; break
        case 'KeyS': k.b = down; break
        case 'KeyA': k.l = down; break
        case 'KeyD': k.r = down; break
        case 'Space': k.jump = down; break
        case 'KeyB': {   // угол выделения хоткеем — из любого инструмента (без авто-повтора зажатия); в режиме вставки — игнор
          if (down && !e.repeat && !paste && document.pointerLockElement) {
            const c = pick()
            if (c) onCorner(cornerOf(c))
          }
          break
        }
      }
    }
    const kd = onKey(true), ku = onKey(false)
    // One place/remove action at the crosshair for the given mouse button.
    const act = (button: number) => {
      if (!document.pointerLockElement) return
      const c = pick()
      if (!c) return
      if (paste) {
        if (button === 0) { if (canStamp(voxels, paste, c.place, half)) onStamp(c.place) }
        else if (button === 2) onPasteCancel()
        return
      }
      if (tool === 'select') {
        if (button === 0) onCorner(cornerOf(c))
        else if (button === 2) onSelectionClear()
        return
      }
      if (button === 0) {
        if (isSpawnTool(tool)) onSpawn(tool === 'spawn0' ? 0 : 1, snapHalf(c.point.x), snapHalf(c.point.z), c.place[1] * VOXEL)
        else {
          const f = camera.getWorldDirection(new THREE.Vector3())
          const isWedge = tool === 'wedge'
          onPlace(c.place, { t: tool, c: color, d: isWedge ? wedgeDir(f.x, f.z, wedgeRot) : 0, f: isWedge && wedgeFlip, bb: brushBeam, tr: brushTransparent, ps: brushPassable })
        }
      } else if (button === 2) onRemove(c.remove)
    }
    // Auto-repeat while a button is held (separate timer per button) — like rapid clicking.
    const held: Partial<Record<number, ReturnType<typeof setInterval>>> = {}
    const stop = (button: number) => { const t = held[button]; if (t != null) { clearInterval(t); delete held[button] } }
    const stopAll = () => { stop(0); stop(2) }
    const onMouseDown = (e: MouseEvent) => {
      if (e.button !== 0 && e.button !== 2) return
      if (!document.pointerLockElement) return   // first click only engages pointer lock
      act(e.button)
      if (held[e.button] == null && tool !== 'select' && !paste) held[e.button] = setInterval(() => act(e.button), AUTOCLICK_MS)
    }
    const onMouseUp = (e: MouseEvent) => stop(e.button)
    const onLockChange = () => { if (!document.pointerLockElement) stopAll() }
    const onCtx = (e: MouseEvent) => e.preventDefault()
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('mouseup', onMouseUp)
    window.addEventListener('blur', stopAll)
    document.addEventListener('pointerlockchange', onLockChange)
    window.addEventListener('contextmenu', onCtx)
    return () => {
      stopAll()
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('mouseup', onMouseUp)
      window.removeEventListener('blur', stopAll)
      document.removeEventListener('pointerlockchange', onLockChange)
      window.removeEventListener('contextmenu', onCtx)
    }
  }, [tool, color, wedgeRot, wedgeFlip, brushBeam, brushTransparent, brushPassable, voxels, half, paste, onPlace, onRemove, onSpawn, onCorner, onSelectionClear, onStamp, onPasteCancel]) // eslint-disable-line react-hooks/exhaustive-deps

  // Cell-top height at point (px,pz): wedge (not flipped) — heightfield slope; cube/flipped — flat top.
  const cellTopAt = (cell: Cell, x: number, y: number, z: number, px: number, pz: number): number => {
    if (cell.t === 'wedge' && !cell.f) {
      const [dx, dz] = HIGH_DIR[cell.d]
      const fx = px / VOXEL - x, fz = pz / VOXEL - z
      let param = dz !== 0 ? (dz > 0 ? fz : 1 - fz) : (dx > 0 ? fx : 1 - fx)
      param = Math.min(1, Math.max(0, param))
      return (y + param) * VOXEL
    }
    return (y + 1) * VOXEL
  }

  // Support surface (ground) and blocking (blocked) for the body [feet,eye].
  // ground — at the player's CENTER (a slope gives a smooth climb; a radius footprint produced false "steps" from neighboring wedge bases).
  // blocked — across the whole footprint (radius): a cell poking above the step within body height is a wall.
  const surfaceInfo = (px: number, pz: number, feet: number, eye: number): { ground: number; blocked: boolean } => {
    let ground = 0
    const cx = Math.floor(px / VOXEL), cz = Math.floor(pz / VOXEL)
    const yReach = Math.floor((feet + STEP) / VOXEL)
    for (let y = 0; y <= yReach; y++) {
      const cell = voxels.get(`${cx},${y},${cz}`)
      if (!cell || cell.ps) continue   // passable blocks provide no support
      const top = cellTopAt(cell, cx, y, cz, px, pz)
      if (top <= feet + STEP + 1e-3) ground = Math.max(ground, top)
    }

    let blocked = false
    const x0 = Math.floor((px - PLAYER_R) / VOXEL), x1 = Math.floor((px + PLAYER_R) / VOXEL)
    const z0 = Math.floor((pz - PLAYER_R) / VOXEL), z1 = Math.floor((pz + PLAYER_R) / VOXEL)
    const yTop = Math.floor((eye - 1e-4) / VOXEL)
    for (let x = x0; x <= x1 && !blocked; x++) for (let z = z0; z <= z1 && !blocked; z++) {
      for (let y = 0; y <= yTop; y++) {
        const cell = voxels.get(`${x},${y},${z}`)
        if (!cell || cell.ps) continue   // passable blocks don't block movement
        if (cellTopAt(cell, x, y, z, px, pz) > feet + STEP + 1e-3 && y * VOXEL < eye - 1e-3) { blocked = true; break }
      }
    }
    return { ground, blocked }
  }

  const tmpDir = useRef(new THREE.Vector3())
  const tmpF = useRef(new THREE.Vector3())
  const tmpR = useRef(new THREE.Vector3())
  useFrame((_, dtRaw) => {
    const dt = Math.min(dtRaw, 0.05)
    const k = keys.current
    const p = camera.position
    const dir = camera.getWorldDirection(tmpDir.current)      // full view direction
    const f = tmpF.current.set(dir.x, 0, dir.z).normalize()   // horizontal projection of the view
    const r = tmpR.current.crossVectors(f, camera.up).normalize()
    const sp = WALK_SPEED * dt

    if (fly) {
      // Fly: WASD along the view (incl. vertical) + Space up; no gravity/collision.
      let mx = 0, my = 0, mz = 0
      if (k.f) { mx += dir.x; my += dir.y; mz += dir.z }
      if (k.b) { mx -= dir.x; my -= dir.y; mz -= dir.z }
      if (k.r) { mx += r.x; mz += r.z }
      if (k.l) { mx -= r.x; mz -= r.z }
      if (k.jump) my += 1
      const len = Math.hypot(mx, my, mz); if (len > 0) { mx /= len; my /= len; mz /= len }
      p.x += mx * sp; p.y += my * sp; p.z += mz * sp
      vy.current = 0
    } else {
      // Walk: gravity + collision with walls/blocks/floor. Horizontal per-axis (sliding along walls).
      let dx = 0, dz = 0
      if (k.f) { dx += f.x; dz += f.z }
      if (k.b) { dx -= f.x; dz -= f.z }
      if (k.r) { dx += r.x; dz += r.z }
      if (k.l) { dx -= r.x; dz -= r.z }
      const len = Math.hypot(dx, dz); if (len > 0) { dx /= len; dz /= len }

      vy.current += GRAVITY * dt
      if (grounded.current && k.jump) vy.current = JUMP_FORCE

      const limX = hx - WALL_HALF - PLAYER_R, limZ = hz - WALL_HALF - PLAYER_R
      const feet = p.y - EYE_HEIGHT, eye = p.y
      const nx = THREE.MathUtils.clamp(p.x + dx * sp, -limX, limX)
      if (!surfaceInfo(nx, p.z, feet, eye).blocked) p.x = nx
      const nz = THREE.MathUtils.clamp(p.z + dz * sp, -limZ, limZ)
      if (!surfaceInfo(p.x, nz, feet, eye).blocked) p.z = nz

      // Vertical: support surface (floor/cube top/wedge slope) — ramp climb and landing.
      const ground = surfaceInfo(p.x, p.z, feet, eye).ground
      let ny = p.y + vy.current * dt
      let grnd = false
      if (ny - EYE_HEIGHT <= ground + 1e-3) { ny = ground + EYE_HEIGHT; vy.current = 0; grnd = true }
      p.y = ny
      grounded.current = grnd
    }

    // placement ghost — for the current tool and auto-orientation
    const g = ghostBoxRef.current, gw = ghostWedgeRef.current, gs = ghostSpawnRef.current
    const c = pick()
    if (c && g && gw && gs) {
      const [x, y, z] = c.place
      if (paste) {
        g.visible = false; gw.visible = false; gs.visible = false
        if (pasteGroup) {
          pasteGroup.visible = true
          pasteGroup.position.set(x * VOXEL, y * VOXEL, z * VOXEL)
          pasteMat.color.set(canStamp(voxels, paste, c.place, half) ? GHOST_COLOR : GHOST_INVALID_COLOR)
        }
      } else if (tool === 'select') {
        g.visible = false; gw.visible = false; gs.visible = false
      } else if (isSpawnTool(tool)) {
        // spawn — a cylinder at the half-grid-snapped point (bottom on the floor)
        g.visible = false; gw.visible = false; gs.visible = true
        gs.position.set(snapHalf(c.point.x), c.place[1] * VOXEL + SPAWN_CYL_H / 2, snapHalf(c.point.z));
        (gs.material as THREE.MeshBasicMaterial).color.set(SPAWN_COLORS[tool === 'spawn0' ? 0 : 1])
      } else if (tool === 'wedge') {
        g.visible = false; gw.visible = true; gs.visible = false
        const d = wedgeDir(f.x, f.z, wedgeRot)
        const b = shapeBlock(x, y, z, { t: 'wedge', c: color, d, f: wedgeFlip, bb: brushBeam, tr: brushTransparent, ps: brushPassable })
        gw.geometry = wedgeFlip ? wedgeGeoFlip : wedgeGeo
        gw.position.set(...b.pos)
        gw.rotation.set(0, wedgeRotationY(d), 0)
        gw.scale.set(b.size[0] * 2, b.size[1] * 2, b.size[2] * 2)
      } else {
        // cube — a cubic ghost on the cell
        gw.visible = false; gs.visible = false; g.visible = true
        g.position.set(...cellCenter(x, y, z))
        g.scale.setScalar(VOXEL)
      }
    } else {
      if (g) g.visible = false
      if (gw) gw.visible = false
      if (gs) gs.visible = false
    }
    if (pasteGroup && (!c || !paste)) pasteGroup.visible = false

    // бокс выделения: от угла 1 до второго угла или ячейки под прицелом (живая растяжка)
    const sb = selBoxRef.current
    if (sb) {
      if (selection) {
        const end = selection.b ?? (c ? cornerOf(c) : selection.a)
        const { min, max } = regionBounds(selection.a, end)
        sb.visible = true
        sb.position.set(
          ((min[0] + max[0] + 1) / 2) * VOXEL,
          ((min[1] + max[1] + 1) / 2) * VOXEL,
          ((min[2] + max[2] + 1) / 2) * VOXEL,
        )
        sb.scale.set((max[0] - min[0] + 1) * VOXEL, (max[1] - min[1] + 1) * VOXEL, (max[2] - min[2] + 1) * VOXEL)
      } else sb.visible = false
    }
  })

  return (
    <>
      <MapLights />
      <PointerLockControls />

      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ editorTarget: true }}>
        <planeGeometry args={[hx * 2, hz * 2]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>
      <lineSegments geometry={gridGeo} position={[0, 0.01, 0]}>
        <lineBasicMaterial color="#555" />
      </lineSegments>

      {/* Perimeter walls (as in-game): sized to the arena */}
      {([[0, hz], [0, -hz], [-hx, 0], [hx, 0]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 1.5, z]} userData={{ editorTarget: true }} castShadow receiveShadow>
          <boxGeometry args={x === 0 ? [hx * 2, 3, 0.5] : [0.5, 3, hz * 2]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      ))}

      {/* Cubes (instances) + shapes (separate meshes) */}
      <primitive object={cubeMeshes.opaque} />
      <primitive object={cubeMeshes.transparent} />
      <ShapeMeshes voxels={voxels} wedgeGeo={wedgeGeo} wedgeGeoFlip={wedgeGeoFlip} />
      {postFx && <MapEdges />}

      {/* "Cube faces": highlight all cell borders (build mode, L) */}
      <lineSegments geometry={edgesGeo} visible={showCubeGrid}>
        <lineBasicMaterial color={BLOCK_GRID_COLOR} transparent opacity={BLOCK_GRID_OPACITY} />
      </lineSegments>

      {/* Placement ghosts: box (cube), wedge and spawn cylinder */}
      <mesh ref={ghostBoxRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={GHOST_COLOR} transparent opacity={GHOST_OPACITY} depthWrite={false} />
      </mesh>
      <mesh ref={ghostWedgeRef} visible={false} geometry={wedgeGeo}>
        <meshBasicMaterial color={GHOST_COLOR} transparent opacity={GHOST_OPACITY} depthWrite={false} />
      </mesh>
      <mesh ref={ghostSpawnRef} visible={false}>
        <cylinderGeometry args={[SPAWN_CYL_R, SPAWN_CYL_R, SPAWN_CYL_H, 24, 1, true]} />
        <meshBasicMaterial color={GHOST_COLOR} alphaMap={spawnAlpha} transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Ghost вставки: полупрозрачная копия фрагмента под прицелом */}
      {pasteGroup && <primitive object={pasteGroup} />}

      {/* Бокс выделения (SELECT): полупрозрачный, виден и изнутри */}
      <mesh ref={selBoxRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color={GHOST_COLOR} transparent opacity={SELECT_BOX_OPACITY} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Spawn markers: a cylinder fading to transparent toward the top (host/guest — by color). */}
      {spawns.map((s, i) => (
        <mesh key={i} position={[s[0], s[1] - EYE_HEIGHT + SPAWN_CYL_H / 2, s[2]]}>
          <cylinderGeometry args={[SPAWN_CYL_R, SPAWN_CYL_R, SPAWN_CYL_H, 24, 1, true]} />
          <meshBasicMaterial color={SPAWN_COLORS[i]} alphaMap={spawnAlpha} transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  )
}
