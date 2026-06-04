import { useMemo, useRef, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { PointerLockControls } from '@react-three/drei'
import * as THREE from 'three'
import { VOXEL, parseCellKey } from './editorStore'
import type { Vec3 } from '../game/maps'
import type { MutableRefObject } from 'react'

const REACH = 14
const FLY_SPEED = 14

type Cell = [number, number, number]

interface Props {
  voxels: Map<string, string>   // новый Map при каждой правке → пересборка инстансов
  half: [number, number]
  floorColor: string
  wallColor: string
  spawns: [Vec3, Vec3]
  brush: number                 // ребро кисти в вокселях (1/2/4)
  color: string
  onPlace: (origin: Cell, brush: number, color: string) => void
  onRemove: (cell: Cell) => void
  camPosRef: MutableRefObject<THREE.Vector3>   // редактор читает позицию камеры (для «спавн тут»)
}

const cellCenter = (x: number, y: number, z: number): [number, number, number] =>
  [(x + 0.5) * VOXEL, (y + 0.5) * VOXEL, (z + 0.5) * VOXEL]

/** Инстансовый меш вокселей (цвет на инстанс). Пересобирается при смене Map (новый Map на каждой правке). */
function useVoxelMesh(voxels: Map<string, string>): THREE.InstancedMesh {
  return useMemo(() => {
    const geo = new THREE.BoxGeometry(VOXEL, VOXEL, VOXEL)
    const mat = new THREE.MeshStandardMaterial()
    const mesh = new THREE.InstancedMesh(geo, mat, Math.max(voxels.size, 1))
    mesh.count = voxels.size
    const m = new THREE.Matrix4()
    const c = new THREE.Color()
    let i = 0
    for (const [k, color] of voxels) {
      const [x, y, z] = parseCellKey(k)
      m.setPosition(...cellCenter(x, y, z))
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, c.set(color))
      i++
    }
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.castShadow = true
    mesh.receiveShadow = true
    mesh.userData.editorTarget = true
    return mesh
  }, [voxels])
}

/** Сцена редактора + управление (полёт + установка/удаление вокселей по прицелу). */
export function EditorScene(props: Props) {
  const { voxels, half, floorColor, wallColor, spawns, brush, color, onPlace, onRemove, camPosRef } = props
  const { camera, scene, raycaster } = useThree()
  const [hx, hz] = half

  const voxelMesh = useVoxelMesh(voxels)
  useEffect(() => () => { voxelMesh.geometry.dispose(); (voxelMesh.material as THREE.Material).dispose() }, [voxelMesh])

  const ghostRef = useRef<THREE.Mesh>(null)
  const keys = useRef({ f: false, b: false, l: false, r: false, up: false, down: false })

  // --- raycast прицела по сцене → клетка установки/удаления ---
  const pick = (): { place: Cell; remove: Cell } | null => {
    raycaster.setFromCamera(new THREE.Vector2(0, 0), camera)
    raycaster.far = REACH
    const targets: THREE.Object3D[] = []
    scene.traverse(o => { if ((o as THREE.Mesh).isMesh && o.userData.editorTarget) targets.push(o) })
    const hits = raycaster.intersectObjects(targets, false)
    if (!hits.length || !hits[0].face) return null
    const p = hits[0].point
    const n = hits[0].face.normal.clone().transformDirection(hits[0].object.matrixWorld).normalize()
    const S = VOXEL
    const toCell = (q: THREE.Vector3): Cell => [Math.floor(q.x / S), Math.floor(q.y / S), Math.floor(q.z / S)]
    const place = toCell(p.clone().addScaledVector(n, S * 0.5))
    const remove = toCell(p.clone().addScaledVector(n, -S * 0.5))
    return { place, remove }
  }

  useEffect(() => {
    const onKey = (down: boolean) => (e: KeyboardEvent) => {
      const k = keys.current
      switch (e.code) {
        case 'KeyW': k.f = down; break
        case 'KeyS': k.b = down; break
        case 'KeyA': k.l = down; break
        case 'KeyD': k.r = down; break
        case 'Space': k.up = down; break
        case 'ShiftLeft': case 'ShiftRight': k.down = down; break
      }
    }
    const kd = onKey(true), ku = onKey(false)
    const onMouseDown = (e: MouseEvent) => {
      if (!document.pointerLockElement) return
      const c = pick()
      if (!c) return
      if (e.button === 0) onPlace(c.place, brush, color)
      else if (e.button === 2) onRemove(c.remove)
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
  }, [brush, color, onPlace, onRemove]) // eslint-disable-line react-hooks/exhaustive-deps

  const tmpF = useRef(new THREE.Vector3())
  const tmpR = useRef(new THREE.Vector3())
  useFrame((_, dt) => {
    // полёт: WASD относительно взгляда (горизонталь) + Space/Shift вертикаль
    const k = keys.current
    const f = camera.getWorldDirection(tmpF.current); f.y = 0; f.normalize()
    const r = tmpR.current.crossVectors(f, camera.up).normalize()
    const step = FLY_SPEED * Math.min(dt, 0.1)
    if (k.f) camera.position.addScaledVector(f, step)
    if (k.b) camera.position.addScaledVector(f, -step)
    if (k.r) camera.position.addScaledVector(r, step)
    if (k.l) camera.position.addScaledVector(r, -step)
    if (k.up) camera.position.y += step
    if (k.down) camera.position.y -= step
    camPosRef.current.copy(camera.position)

    // призрак места установки
    const g = ghostRef.current
    if (g) {
      const c = pick()
      if (c) {
        g.visible = true
        const [x, y, z] = c.place
        // кисть brush³ от угла-клетки: центр = угол + (brush/2)
        g.position.set((x + brush / 2) * VOXEL, (y + brush / 2) * VOXEL, (z + brush / 2) * VOXEL)
        g.scale.setScalar(brush)
      } else g.visible = false
    }
  })

  return (
    <>
      <ambientLight intensity={0.5} />
      <directionalLight position={[10, 20, 8]} intensity={1.1} castShadow />
      <PointerLockControls />

      {/* Пол */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow userData={{ editorTarget: true }}>
        <planeGeometry args={[hx * 2, hz * 2]} />
        <meshStandardMaterial color={floorColor} />
      </mesh>
      <gridHelper args={[hx * 2, hx * 2, '#888', '#444']} scale={[1, 1, hz / hx]} />

      {/* Периметровые стены (как в игре): по размеру арены */}
      {([[0, hz], [0, -hz], [-hx, 0], [hx, 0]] as const).map(([x, z], i) => (
        <mesh key={i} position={[x, 1.5, z]} userData={{ editorTarget: true }} castShadow receiveShadow>
          <boxGeometry args={x === 0 ? [hx * 2, 3, 0.5] : [0.5, 3, hz * 2]} />
          <meshStandardMaterial color={wallColor} />
        </mesh>
      ))}

      {/* Воксели */}
      <primitive object={voxelMesh} />

      {/* Призрак установки */}
      <mesh ref={ghostRef} visible={false}>
        <boxGeometry args={[VOXEL, VOXEL, VOXEL]} />
        <meshBasicMaterial color="#4af" transparent opacity={0.35} depthWrite={false} />
      </mesh>

      {/* Маркеры спавнов */}
      {spawns.map((s, i) => (
        <mesh key={i} position={s}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color={i === 0 ? '#4af' : '#fa4'} transparent opacity={0.6} />
        </mesh>
      ))}
    </>
  )
}
