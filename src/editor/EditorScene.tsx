import { useMemo, useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { VOXEL, parseCellKey, shapeBlock } from './editorStore'
import type { Cell, BlockType, Dir } from './editorStore'
import type { Vec3 } from '../game/maps'
import { GRAVITY, JUMP_FORCE, EYE_HEIGHT, BLOCK_TRANSPARENT_OPACITY } from '../constants'
import { unitWedgeGeometry, wedgeRotationY } from '../game/wedge'
import { gridGeometry } from '../game/grid'
import { MapLights } from '../components/MapVisualBits'
import { MapEdges, BLOCK_LAYER } from '../components/EdgeOutline'
import { loadProfile } from '../settings'

const REACH = 14
const WALK_SPEED = 6.5
const PLAYER_R = 0.3          // горизонтальный полу-размер игрока (для коллизии в режиме ходьбы)
const WALL_HALF = 0.25        // полу-толщина периметровой стены (как в editor walls)
// Маркер спавна — вертикальный цилиндр, к верху уходящий в прозрачность (хост / гость различаются цветом).
// Центр привязан к полусетке (шаг VOXEL/2): попадает и в центр ячейки, и на пересечение линий сетки.
const SPAWN_CYL_R = 0.4
const SPAWN_CYL_H = 2.4
const SPAWN_SNAP = VOXEL / 2
const snapHalf = (v: number) => Math.round(v / SPAWN_SNAP) * SPAWN_SNAP
const SPAWN_COLORS = ['#4af', '#fa4'] as const

type CellCoord = [number, number, number]
// Инструмент хотбара: тип блока или установка спавна (хост=0 / гость=1).
export type EditorTool = BlockType | 'spawn0' | 'spawn1'
const isSpawnTool = (t: EditorTool): t is 'spawn0' | 'spawn1' => t === 'spawn0' || t === 'spawn1'

// Стороны для авто-ориентации клина: dir 0=+Z,1=+X,2=−Z,3=−X.
const CARDINALS: ReadonlyArray<readonly [Dir, number, number]> = [[0, 0, 1], [1, 1, 0], [2, 0, -1], [3, -1, 0]]
function dirFromFacing(fx: number, fz: number): Dir {
  let best: Dir = 0, bestDot = -Infinity
  for (const [d, cx, cz] of CARDINALS) {
    const dot = fx * cx + fz * cz
    if (dot > bestDot) { bestDot = dot; best = d }
  }
  return best
}
/** Ориентация клина при установке: низкая сторона к игроку, скос поднимается по взгляду (заходишь и идёшь
 * вверх) + ручной доворот rot·90° (R). */
function wedgeDir(fx: number, fz: number, rot: number): Dir {
  return ((dirFromFacing(fx, fz) + rot) % 4) as Dir
}
/** Шаг на одну клетку вдоль доминирующей оси нормали грани (для установки «вплотную»). */
function axisStep(n: THREE.Vector3): CellCoord {
  const ax = Math.abs(n.x), ay = Math.abs(n.y), az = Math.abs(n.z)
  if (ax >= ay && ax >= az) return [Math.sign(n.x), 0, 0]
  if (ay >= az) return [0, Math.sign(n.y), 0]
  return [0, 0, Math.sign(n.z)]
}

// Высокая сторона клина в мире по dir (учитывая wedgeRotationY = −dir·90°): d0=+Z,1=−X,2=−Z,3=+X.
const HIGH_DIR: Record<Dir, [number, number]> = { 0: [0, 1], 1: [-1, 0], 2: [0, -1], 3: [1, 0] }
const STEP = 0.4   // макс. высота шага вверх (как autostep в игре; > подъёма за кадр на скосе, < ребра куба)

interface Props {
  voxels: Map<string, Cell>     // новый Map при каждой правке → пересборка инстансов
  half: [number, number]
  floorColor: string
  wallColor: string
  spawns: [Vec3, Vec3]
  tool: EditorTool              // активный инструмент (куб/клин/спавн)
  fly: boolean                  // режим полёта (без гравитации/коллизии); по дефолту false
  wedgeRot: number              // ручной доворот клина (R) поверх авто-ориентации, шаг 90°
  wedgeFlip: boolean            // клин перевёрнут по Y (T) — скос снизу
  showCubeGrid: boolean         // подсветка границ всех клеток (L) — строительный режим
  color: string
  brushBeam: boolean            // кисть: blocksBeam (true=непростреливаемый)
  brushTransparent: boolean     // кисть: полупрозрачный
  brushPassable: boolean        // кисть: проходимый (без коллайдера)
  onPlace: (cell: CellCoord, data: Cell) => void
  onRemove: (cell: CellCoord) => void
  onSpawn: (idx: 0 | 1, x: number, z: number, surfaceY: number) => void
}

const cellCenter = (x: number, y: number, z: number): [number, number, number] =>
  [(x + 0.5) * VOXEL, (y + 0.5) * VOXEL, (z + 0.5) * VOXEL]

/** Вертикальный градиент для alphaMap цилиндра-спавна: низ непрозрачный → верх прозрачный. */
function useSpawnAlpha(): THREE.Texture {
  return useMemo(() => {
    const cv = document.createElement('canvas')
    cv.width = 1; cv.height = 64
    const ctx = cv.getContext('2d')!
    const g = ctx.createLinearGradient(0, 0, 0, 64)
    g.addColorStop(0, '#000')   // верх канваса → верх цилиндра (flipY): прозрачно
    g.addColorStop(1, '#fff')   // низ: непрозрачно
    ctx.fillStyle = g
    ctx.fillRect(0, 0, 1, 64)
    return new THREE.CanvasTexture(cv)
  }, [])
}

// Рёбра единичного куба: 8 вершин (полу-ребро) + 12 рёбер (пары индексов).
const EDGE_CORNERS: ReadonlyArray<readonly [number, number, number]> = [
  [-0.5, -0.5, -0.5], [0.5, -0.5, -0.5], [0.5, -0.5, 0.5], [-0.5, -0.5, 0.5],
  [-0.5, 0.5, -0.5], [0.5, 0.5, -0.5], [0.5, 0.5, 0.5], [-0.5, 0.5, 0.5],
]
const EDGE_PAIRS: ReadonlyArray<readonly [number, number]> = [
  [0, 1], [1, 2], [2, 3], [3, 0], [4, 5], [5, 6], [6, 7], [7, 4], [0, 4], [1, 5], [2, 6], [3, 7],
]

/** Геометрия контуров клеток (границы кубов) — линии по рёбрам каждой занятой клетки. */
function useEdgesGeometry(voxels: Map<string, Cell>): THREE.BufferGeometry {
  return useMemo(() => {
    const pos: number[] = []
    for (const [k] of voxels) {
      const [x, y, z] = parseCellKey(k)
      const [cx, cy, cz] = cellCenter(x, y, z)
      for (const [a, b] of EDGE_PAIRS) {
        const pa = EDGE_CORNERS[a], pb = EDGE_CORNERS[b]
        pos.push(cx + pa[0] * VOXEL, cy + pa[1] * VOXEL, cz + pa[2] * VOXEL,
          cx + pb[0] * VOXEL, cy + pb[1] * VOXEL, cz + pb[2] * VOXEL)
      }
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3))
    return g
  }, [voxels])
}

/** Инстансовый меш кубов (t==='cube'); цвет на инстанс. Пересобирается при смене Map. */
function useCubeMeshes(voxels: Map<string, Cell>): { opaque: THREE.InstancedMesh; transparent: THREE.InstancedMesh } {
  return useMemo(() => {
    const build = (cells: [string, Cell][], transparent: boolean) => {
      const geo = new THREE.BoxGeometry(VOXEL, VOXEL, VOXEL)
      const mat = new THREE.MeshStandardMaterial(transparent ? { transparent: true, opacity: BLOCK_TRANSPARENT_OPACITY, depthWrite: false } : {})
      const mesh = new THREE.InstancedMesh(geo, mat, Math.max(cells.length, 1))
      mesh.layers.enable(BLOCK_LAYER)   // в контур рёбер
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

/** Отдельные меши клиньев (не-кубовых ячеек). На слое блоков → попадают в контур рёбер. */
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

/** Сцена редактора + управление (ходьба с гравитацией + установка/удаление блоков по прицелу). */
export function EditorScene(props: Props) {
  const { voxels, half, floorColor, wallColor, spawns, tool, fly, wedgeRot, wedgeFlip, showCubeGrid, color, brushBeam, brushTransparent, brushPassable, onPlace, onRemove, onSpawn } = props
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
  const keys = useRef({ f: false, b: false, l: false, r: false, jump: false })
  const vy = useRef(0)
  const grounded = useRef(false)

  // --- raycast прицела по сцене → клетка установки/удаления (+ точка попадания для спавна) ---
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
    // Установка от ячейки формы (под-клеточный размер ломает геометрию: грань внутри ячейки) → шаг по нормали;
    // для полноразмерных целей (куб/пол/стена) — геометрически. Удаление формы — по её cellKey.
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

  useEffect(() => {
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = keys.current
      switch (e.code) {
        case 'KeyW': k.f = down; break
        case 'KeyS': k.b = down; break
        case 'KeyA': k.l = down; break
        case 'KeyD': k.r = down; break
        case 'Space': k.jump = down; break
      }
    }
    const kd = onKey(true), ku = onKey(false)
    const onMouseDown = (e: MouseEvent) => {
      if (!document.pointerLockElement) return
      const c = pick()
      if (!c) return
      if (e.button === 0) {
        if (isSpawnTool(tool)) onSpawn(tool === 'spawn0' ? 0 : 1, snapHalf(c.point.x), snapHalf(c.point.z), c.place[1] * VOXEL)
        else {
          const f = camera.getWorldDirection(new THREE.Vector3())
          const isWedge = tool === 'wedge'
          onPlace(c.place, { t: tool, c: color, d: isWedge ? wedgeDir(f.x, f.z, wedgeRot) : 0, f: isWedge && wedgeFlip, bb: brushBeam, tr: brushTransparent, ps: brushPassable })
        }
      } else if (e.button === 2) onRemove(c.remove)
    }
    const onCtx = (e: MouseEvent) => e.preventDefault()
    window.addEventListener('keydown', kd)
    window.addEventListener('keyup', ku)
    window.addEventListener('mousedown', onMouseDown)
    window.addEventListener('contextmenu', onCtx)
    return () => {
      window.removeEventListener('keydown', kd)
      window.removeEventListener('keyup', ku)
      window.removeEventListener('mousedown', onMouseDown)
      window.removeEventListener('contextmenu', onCtx)
    }
  }, [tool, color, wedgeRot, wedgeFlip, brushBeam, brushTransparent, brushPassable, onPlace, onRemove, onSpawn]) // eslint-disable-line react-hooks/exhaustive-deps

  // Высота верха клетки в точке (px,pz): клин (не перевёрнутый) — наклон heightfield; куб/перевёрнутый — плоский верх.
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

  // Опорная поверхность (ground) и блокировка (blocked) для тела [feet,eye].
  // ground — по ЦЕНТРУ игрока (скос даёт гладкий подъём; след с радиусом давал ложные «ступени» от баз соседних клиньев).
  // blocked — по всему следу (радиус): клетка, торчащая выше шага в пределах роста, — стена.
  const surfaceInfo = (px: number, pz: number, feet: number, eye: number): { ground: number; blocked: boolean } => {
    let ground = 0
    const cx = Math.floor(px / VOXEL), cz = Math.floor(pz / VOXEL)
    const yReach = Math.floor((feet + STEP) / VOXEL)
    for (let y = 0; y <= yReach; y++) {
      const cell = voxels.get(`${cx},${y},${cz}`)
      if (!cell || cell.ps) continue   // проходимые блоки не дают опоры
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
        if (!cell || cell.ps) continue   // проходимые блоки не блокируют движение
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
    const dir = camera.getWorldDirection(tmpDir.current)      // полное направление взгляда
    const f = tmpF.current.set(dir.x, 0, dir.z).normalize()   // горизонтальная проекция взгляда
    const r = tmpR.current.crossVectors(f, camera.up).normalize()
    const sp = WALK_SPEED * dt

    if (fly) {
      // Полёт: WASD вдоль взгляда (вкл. вертикаль) + Space вверх; без гравитации/коллизии.
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
      // Ходьба: гравитация + коллизия со стенами/блоками/полом. Горизонталь по осям (скольжение вдоль стен).
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

      // Вертикаль: опорная поверхность (пол/верх куба/скос клина) — подъём по рампе и посадка.
      const ground = surfaceInfo(p.x, p.z, feet, eye).ground
      let ny = p.y + vy.current * dt
      let grnd = false
      if (ny - EYE_HEIGHT <= ground + 1e-3) { ny = ground + EYE_HEIGHT; vy.current = 0; grnd = true }
      p.y = ny
      grounded.current = grnd
    }

    // призрак места установки — текущего инструмента и авто-ориентации
    const g = ghostBoxRef.current, gw = ghostWedgeRef.current, gs = ghostSpawnRef.current
    const c = pick()
    if (c && g && gw && gs) {
      const [x, y, z] = c.place
      if (isSpawnTool(tool)) {
        // спавн — цилиндр в привязанной к полусетке точке (низ на полу)
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
        // куб — кубический призрак на клетке
        gw.visible = false; gs.visible = false; g.visible = true
        g.position.set(...cellCenter(x, y, z))
        g.scale.setScalar(VOXEL)
      }
    } else {
      if (g) g.visible = false
      if (gw) gw.visible = false
      if (gs) gs.visible = false
    }
  })

  return (
    <>
      <MapLights />
      <PointerLockControls />

      {/* Пол */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ editorTarget: true }}>
        <planeGeometry args={[hx * 2, hz * 2]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>
      <lineSegments geometry={gridGeo} position={[0, 0.01, 0]}>
        <lineBasicMaterial color="#555" />
      </lineSegments>

      {/* Периметровые стены (как в игре): по размеру арены */}
      {([[0, hz], [0, -hz], [-hx, 0], [hx, 0]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 1.5, z]} userData={{ editorTarget: true }} castShadow receiveShadow>
          <boxGeometry args={x === 0 ? [hx * 2, 3, 0.5] : [0.5, 3, hz * 2]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      ))}

      {/* Кубы (инстансы) + формы (отдельные меши) */}
      <primitive object={cubeMeshes.opaque} />
      <primitive object={cubeMeshes.transparent} />
      <ShapeMeshes voxels={voxels} wedgeGeo={wedgeGeo} wedgeGeoFlip={wedgeGeoFlip} />
      {postFx && <MapEdges />}

      {/* «Грани кубов»: подсветка границ всех клеток (строительный режим, L) */}
      <lineSegments geometry={edgesGeo} visible={showCubeGrid}>
        <lineBasicMaterial color="#4af" transparent opacity={0.5} />
      </lineSegments>

      {/* Призраки установки: бокс (куб), клин и цилиндр-спавн */}
      <mesh ref={ghostBoxRef} visible={false}>
        <boxGeometry args={[1, 1, 1]} />
        <meshBasicMaterial color="#4af" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh ref={ghostWedgeRef} visible={false} geometry={wedgeGeo}>
        <meshBasicMaterial color="#4af" transparent opacity={0.35} depthWrite={false} />
      </mesh>
      <mesh ref={ghostSpawnRef} visible={false}>
        <cylinderGeometry args={[SPAWN_CYL_R, SPAWN_CYL_R, SPAWN_CYL_H, 24, 1, true]} />
        <meshBasicMaterial color="#4af" alphaMap={spawnAlpha} transparent opacity={0.5} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>

      {/* Маркеры спавнов: цилиндр, к верху уходящий в прозрачность (хост/гость — цветом). */}
      {spawns.map((s, i) => (
        <mesh key={i} position={[s[0], s[1] - EYE_HEIGHT + SPAWN_CYL_H / 2, s[2]]}>
          <cylinderGeometry args={[SPAWN_CYL_R, SPAWN_CYL_R, SPAWN_CYL_H, 24, 1, true]} />
          <meshBasicMaterial color={SPAWN_COLORS[i]} alphaMap={spawnAlpha} transparent opacity={0.55} depthWrite={false} side={THREE.DoubleSide} />
        </mesh>
      ))}
    </>
  )
}
