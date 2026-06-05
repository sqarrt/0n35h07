import { useState, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { EYE_HEIGHT } from '../constants'
import type { Vec3 } from '../game/maps'
import { EditorScene } from './EditorScene'
import type { EditorTool } from './EditorScene'
import { cellKey, voxelize, toMapData, wallColorOf } from './editorStore'
import type { Cell, MapData } from './editorStore'
import { loadMap, saveMap } from './mapsApi'
import './editor.css'

type CellCoord = [number, number, number]

// Палитра строителя: камень/песок/дерево/металл + акценты. Используется для блоков, пола и стен.
const EDITOR_COLORS = ['#8a8f98', '#5a6678', '#b89863', '#8a5a2b', '#c2a878', '#9a7b46', '#4af', '#fa4', '#4fa', '#f66', '#222', '#ddd']

// Инструменты хотбара (клавиши 1–4). Ориентация клина — авто по взгляду.
const TOOLS: { tool: EditorTool; label: string }[] = [
  { tool: 'cube', label: 'КУБ' },
  { tool: 'wedge', label: 'КЛИН' },
  { tool: 'spawn0', label: 'СПАВН ХОСТА' },
  { tool: 'spawn1', label: 'СПАВН ГОСТЯ' },
]
const TOOL_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4']

/** Ряд свотчей выбора цвета из палитры. */
function Palette({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="editor-pal">
      {EDITOR_COLORS.map(c => (
        <span key={c} className={`swatch${c === value ? ' swatch--sel' : ''}`} style={{ background: c, color: c }} onClick={() => onPick(c)} />
      ))}
    </div>
  )
}

/** Редактор одной карты (name из роута). Существующую грузит из src/maps, отсутствующую открывает пустой. */
export function MapEditor({ name }: { name: string }) {
  const [voxels, setVoxels] = useState<Map<string, Cell>>(() => new Map())

  const [half, setHalf] = useState<[number, number]>([20, 20])
  const [floorColor, setFloorColor] = useState('#3a3f47')
  const [wallColor, setWallColor] = useState('#5a6678')
  const [spawns, setSpawns] = useState<[Vec3, Vec3]>([[0, EYE_HEIGHT, 16], [0, EYE_HEIGHT, -16]])
  const [tool, setTool] = useState<EditorTool>('cube')
  const [fly, setFly] = useState(false)   // Tab: полёт без гравитации/коллизии; по дефолту ходьба
  const [wedgeRot, setWedgeRot] = useState(0)   // R: ручной доворот клина поверх авто-ориентации
  const [wedgeFlip, setWedgeFlip] = useState(false)   // T: клин вверх ногами (скос снизу)
  const [showCubeGrid, setShowCubeGrid] = useState(true)   // L: подсветка границ всех клеток (стройка)
  const [color, setColor] = useState(EDITOR_COLORS[2])
  const [locked, setLocked] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState('')

  const loadInto = useCallback((data: MapData) => {
    setHalf(data.half)
    setFloorColor(data.floorColor)
    setWallColor(wallColorOf(data))
    setSpawns(data.spawns)
    setVoxels(voxelize(data.blocks))
  }, [])

  // Загрузка карты по имени роута (отсутствующая = новая пустая с этим id).
  useEffect(() => {
    let alive = true
    void loadMap(name).then(data => {
      if (!alive) return
      if (data) loadInto(data)
      setLoaded(true)
    })
    return () => { alive = false }
  }, [name, loadInto])

  const onPlace = useCallback((cell: CellCoord, data: Cell) => {
    if (cell[1] < 0) return
    setVoxels(prev => {
      const m = new Map(prev)
      m.set(cellKey(...cell), data)
      return m
    })
  }, [])

  const onRemove = useCallback((cell: CellCoord) => {
    setVoxels(prev => {
      if (!prev.has(cellKey(...cell))) return prev
      const m = new Map(prev)
      m.delete(cellKey(...cell))
      return m
    })
  }, [])

  // Спавн — привязанная к полусетке точка (X/Z из сцены), на уровень глаз.
  const onSpawn = useCallback((idx: 0 | 1, x: number, z: number) => {
    setSpawns(prev => {
      const next: [Vec3, Vec3] = [prev[0], prev[1]]
      next[idx] = [x, EYE_HEIGHT, z]
      return next
    })
  }, [])

  useEffect(() => {
    const onLock = () => setLocked(!!document.pointerLockElement)
    document.addEventListener('pointerlockchange', onLock)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Tab') { e.preventDefault(); setFly(v => !v); return }
      if (e.code === 'KeyR') { setWedgeRot(v => (v + 1) % 4); return }
      if (e.code === 'KeyT') { setWedgeFlip(v => !v); return }
      if (e.code === 'KeyL') { setShowCubeGrid(v => !v); return }
      const idx = TOOL_KEYS.indexOf(e.code)
      if (idx >= 0) setTool(TOOLS[idx].tool)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerlockchange', onLock)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const buildMap = (): MapData =>
    toMapData(voxels, { half, floorColor, wallColor, spawns, id: name })

  const doSave = async () => {
    setStatus('сохранение…')
    const ok = await saveMap(name, buildMap())
    setStatus(ok ? `сохранено: ${name}.json` : 'ошибка сохранения')
  }

  const count = voxels.size

  if (!loaded) {
    return <div className="editor-root" style={{ color: 'var(--accent)', fontFamily: 'var(--ui-font)', padding: 20 }}>Загрузка карты «{name}»…</div>
  }

  return (
    <div className="editor-root">
      <Canvas shadows camera={{ fov: 75, position: [0, 6, 26], near: 0.1, far: 400 }}>
        <EditorScene
          voxels={voxels}
          half={half} floorColor={floorColor} wallColor={wallColor} spawns={spawns}
          tool={tool} fly={fly} wedgeRot={wedgeRot} wedgeFlip={wedgeFlip} showCubeGrid={showCubeGrid} color={color}
          onPlace={onPlace} onRemove={onRemove} onSpawn={onSpawn}
        />
      </Canvas>

      {/* Прицел */}
      <div className="editor-crosshair" />

      {!locked && <div className="editor-hint">КЛИК — захватить мышь · ЛКМ ставить · ПКМ убирать{tool === 'wedge' ? ' · R — поворот, T — перевернуть клин' : ''} · WASD — движение, Space — {fly ? 'вверх' : 'прыжок'} · TAB — {fly ? 'полёт' : 'ходьба'} · L — грани кубов: {showCubeGrid ? 'вкл' : 'выкл'} · ESC — меню</div>}

      {/* Хотбар: инструменты (куб/клин/спавны) + палитра цвета блока */}
      <div className="editor-hotbar">
        {TOOLS.map(({ tool: t, label }, i) => (
          <button key={t} className={`seg${tool === t ? ' seg--on' : ''}`} onClick={() => setTool(t)}>
            {i + 1}·{label}
          </button>
        ))}
        <span className="editor-sep" />
        {EDITOR_COLORS.map(c => (
          <span key={c} className={`swatch${c === color ? ' swatch--sel' : ''}`} style={{ background: c, color: c }} onClick={() => setColor(c)} />
        ))}
      </div>

      {/* Боковая панель */}
      <div className="editor-panel">
        <div className="editor-title">РЕДАКТОР КАРТ <span className="editor-dim">блоков: {count}</span></div>

        <div className="editor-row"><span>КАРТА</span>
          <span className="editor-name">{name}</span>
        </div>

        <div className="editor-row"><span>АРЕНА X</span>
          <input className="input" type="number" value={half[0]} min={4} onChange={e => setHalf([Math.max(4, +e.target.value), half[1]])} />
          <span>Z</span>
          <input className="input" type="number" value={half[1]} min={4} onChange={e => setHalf([half[0], Math.max(4, +e.target.value)])} />
        </div>

        <div className="editor-row"><span>ПОЛ</span><Palette value={floorColor} onPick={setFloorColor} /></div>
        <div className="editor-row"><span>СТЕНЫ</span><Palette value={wallColor} onPick={setWallColor} /></div>

        <div className="editor-row">
          <button className="btn" onClick={doSave}>СОХРАНИТЬ</button>
          {status && <span className="editor-dim">{status}</span>}
        </div>

        <a className="editor-exit" href="#editor">← к выбору карт</a>
      </div>
    </div>
  )
}
