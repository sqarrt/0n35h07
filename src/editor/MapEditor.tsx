import { useRef, useState, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import * as THREE from 'three'
import { EYE_HEIGHT } from '../constants'
import type { Vec3 } from '../game/maps'
import { EditorScene } from './EditorScene'
import {
  BRUSH, cellKey, voxelize, toMapData, serializeMap, parseMap, saveMap, listMaps, loadMap, wallColorOf,
} from './editorStore'
import type { BrushSize, MapData } from './editorStore'
import './editor.css'

type Cell = [number, number, number]

// Палитра строителя: камень/песок/дерево/металл + акценты.
const EDITOR_COLORS = ['#8a8f98', '#5a6678', '#b89863', '#8a5a2b', '#c2a878', '#9a7b46', '#4af', '#fa4', '#4fa', '#f66', '#222', '#ddd']

export function MapEditor() {
  const [voxels, setVoxels] = useState<Map<string, string>>(() => new Map())

  const [half, setHalf] = useState<[number, number]>([20, 20])
  const [floorColor, setFloorColor] = useState('#3a3f47')
  const [wallColor, setWallColor] = useState('#555')
  const [spawns, setSpawns] = useState<[Vec3, Vec3]>([[0, EYE_HEIGHT, 16], [0, EYE_HEIGHT, -16]])
  const [brush, setBrush] = useState<BrushSize>('small')
  const [color, setColor] = useState(EDITOR_COLORS[2])
  const [locked, setLocked] = useState(false)
  const [json, setJson] = useState('')
  const [saved, setSaved] = useState<string[]>(() => listMaps())

  const camPos = useRef(new THREE.Vector3(0, 6, 26))

  const onPlace = useCallback((origin: Cell, n: number, col: string) => {
    setVoxels(prev => {
      const m = new Map(prev)
      const [ox, oy, oz] = origin
      for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) for (let z = 0; z < n; z++) {
        if (oy + y < 0) continue
        m.set(cellKey(ox + x, oy + y, oz + z), col)
      }
      return m
    })
  }, [])

  const onRemove = useCallback((cell: Cell) => {
    setVoxels(prev => {
      if (!prev.has(cellKey(...cell))) return prev
      const m = new Map(prev)
      m.delete(cellKey(...cell))
      return m
    })
  }, [])

  useEffect(() => {
    const onLock = () => setLocked(!!document.pointerLockElement)
    document.addEventListener('pointerlockchange', onLock)
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Digit1') setBrush('small')
      if (e.code === 'Digit2') setBrush('medium')
      if (e.code === 'Digit3') setBrush('large')
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerlockchange', onLock)
      window.removeEventListener('keydown', onKey)
    }
  }, [])

  const buildMap = (): MapData =>
    toMapData(voxels, { half, floorColor, wallColor, spawns })

  const exportJson = async () => {
    const s = serializeMap(buildMap())
    setJson(s)
    try { await navigator.clipboard.writeText(s) } catch { /* покажем в textarea */ }
  }

  const doSave = () => {
    const name = prompt('Имя карты:')?.trim()
    if (!name) return
    saveMap(name, buildMap())
    setSaved(listMaps())
  }

  const loadInto = (data: MapData) => {
    setHalf(data.half)
    setFloorColor(data.floorColor)
    setWallColor(wallColorOf(data))
    setSpawns(data.spawns)
    setVoxels(voxelize(data.blocks))
  }

  const doImport = (name: string) => {
    const data = loadMap(name)
    if (data) loadInto(data)
  }

  const importPasted = () => {
    const data = parseMap(json)
    if (data) loadInto(data); else alert('Невалидный JSON карты')
  }

  const setSpawnHere = (idx: 0 | 1) => {
    const p = camPos.current
    setSpawns(prev => {
      const next: [Vec3, Vec3] = [prev[0], prev[1]]
      next[idx] = [Math.round(p.x), EYE_HEIGHT, Math.round(p.z)]
      return next
    })
  }

  const count = voxels.size

  return (
    <div className="editor-root">
      <Canvas shadows camera={{ fov: 75, position: [0, 6, 26], near: 0.1, far: 400 }}>
        <EditorScene
          voxels={voxels}
          half={half} floorColor={floorColor} wallColor={wallColor} spawns={spawns}
          brush={BRUSH[brush]} color={color}
          onPlace={onPlace} onRemove={onRemove} camPosRef={camPos}
        />
      </Canvas>

      {/* Прицел */}
      <div className="editor-crosshair" />

      {!locked && <div className="editor-hint">КЛИК — захватить мышь · ЛКМ ставить · ПКМ убирать · WASD+Space/Shift — полёт · ESC — меню</div>}

      {/* Хотбар: размеры кисти + палитра */}
      <div className="editor-hotbar">
        {(['small', 'medium', 'large'] as BrushSize[]).map((b, i) => (
          <button key={b} className={`seg${brush === b ? ' seg--on' : ''}`} onClick={() => setBrush(b)}>
            {i + 1}·{b.toUpperCase()} {BRUSH[b]}³
          </button>
        ))}
        <span className="editor-sep" />
        {EDITOR_COLORS.map(c => (
          <span key={c} className={`swatch${c === color ? ' swatch--sel' : ''}`} style={{ background: c, color: c }} onClick={() => setColor(c)} />
        ))}
      </div>

      {/* Боковая панель */}
      <div className="editor-panel">
        <div className="editor-title">РЕДАКТОР КАРТ <span className="editor-dim">кубов: {count}</span></div>

        <div className="editor-row"><span>АРЕНА X</span>
          <input className="input" type="number" value={half[0]} min={4} onChange={e => setHalf([Math.max(4, +e.target.value), half[1]])} />
          <span>Z</span>
          <input className="input" type="number" value={half[1]} min={4} onChange={e => setHalf([half[0], Math.max(4, +e.target.value)])} />
        </div>
        <div className="editor-row"><span>ПОЛ</span><input type="color" value={floorColor} onChange={e => setFloorColor(e.target.value)} />
          <span>СТЕНЫ</span><input type="color" value={wallColor} onChange={e => setWallColor(e.target.value)} /></div>

        <div className="editor-row">
          <button className="seg" onClick={() => setSpawnHere(0)}>СПАВН ХОСТА ТУТ</button>
          <button className="seg" onClick={() => setSpawnHere(1)}>СПАВН СОПЕРНИКА ТУТ</button>
        </div>

        <div className="editor-row">
          <button className="btn" onClick={doSave}>СОХРАНИТЬ</button>
          <button className="btn" onClick={exportJson}>JSON → буфер</button>
        </div>
        <div className="editor-row">
          <select className="input" defaultValue="" onChange={e => { if (e.target.value) doImport(e.target.value) }}>
            <option value="">ИМПОРТ…</option>
            {saved.map(n => <option key={n} value={n}>{n}</option>)}
          </select>
          <button className="btn btn--ghost" onClick={importPasted}>ИЗ JSON НИЖЕ</button>
        </div>
        <textarea className="editor-json" value={json} onChange={e => setJson(e.target.value)} placeholder="JSON карты (Сохранить/Экспорт сюда; можно вставить и импортировать)" />
        <a className="editor-exit" href="#">← выйти из редактора</a>
      </div>
    </div>
  )
}
