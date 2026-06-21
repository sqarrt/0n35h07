import { useState, useEffect, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { EYE_HEIGHT } from '../constants'
import type { Vec3, GameMap } from '../game/maps'
import { compileBlocks, serializeGeo } from '../game/mapGeometryCache'
import { ThumbnailRenderer } from '../components/MapPreview'
import { EditorScene } from './EditorScene'
import type { EditorTool } from './EditorScene'
import { cellKey, voxelize, toMapData, wallColorOf } from './editorStore'
import type { Cell, MapData } from './editorStore'
import { loadMap, saveMap, saveCompiled, saveThumbnail } from './mapsApi'
import './editor.css'

type CellCoord = [number, number, number]

// Builder palette: stone/sand/wood/metal + accents. Used for blocks, floor and walls.
const EDITOR_COLORS = ['#8a8f98', '#5a6678', '#b89863', '#8a5a2b', '#c2a878', '#9a7b46', '#4af', '#cdf', '#fa4', '#4fa', '#f66', '#f9c', '#222', '#ddd', '#fff']

// Hotbar tools (keys 1-4). Wedge orientation is auto-derived from view.
const TOOLS: { tool: EditorTool; label: string }[] = [
  { tool: 'cube', label: 'CUBE' },
  { tool: 'wedge', label: 'WEDGE' },
  { tool: 'spawn0', label: 'HOST SPAWN' },
  { tool: 'spawn1', label: 'GUEST SPAWN' },
]
const TOOL_KEYS = ['Digit1', 'Digit2', 'Digit3', 'Digit4']

/** Row of palette color-pick swatches. */
function Palette({ value, onPick }: { value: string; onPick: (c: string) => void }) {
  return (
    <div className="editor-pal">
      {EDITOR_COLORS.map(c => (
        <span key={c} className={`swatch${c === value ? ' swatch--sel' : ''}`} style={{ background: c, color: c }} onClick={() => onPick(c)} />
      ))}
    </div>
  )
}

/** Single-map editor (name from route). Loads an existing map from src/maps, opens a missing one empty. */
export function MapEditor({ name }: { name: string }) {
  const [voxels, setVoxels] = useState<Map<string, Cell>>(() => new Map())

  const [half, setHalf] = useState<[number, number]>([20, 20])
  const [floorColor, setFloorColor] = useState('#3a3f47')
  const [wallColor, setWallColor] = useState('#5a6678')
  const [spawns, setSpawns] = useState<[Vec3, Vec3]>([[0, EYE_HEIGHT, 16], [0, EYE_HEIGHT, -16]])
  const [tool, setTool] = useState<EditorTool>('cube')
  const [fly, setFly] = useState(false)   // Tab: fly with no gravity/collision; walking by default
  const [wedgeRot, setWedgeRot] = useState(0)   // R: manual wedge spin on top of auto-orientation
  const [wedgeFlip, setWedgeFlip] = useState(false)   // T: wedge upside down (bevel underneath)
  const [showCubeGrid, setShowCubeGrid] = useState(true)   // L: highlight all cell borders (build mode)
  const [showGridInGame, setShowGridInGame] = useState(false)   // persisted map setting: draw the cube grid in-game
  const [color, setColor] = useState(EDITOR_COLORS[2])
  const [brushBeam, setBrushBeam] = useState(true)    // beam-blocking by default (blocksBeam=true)
  const [brushTransparent, setBrushTransparent] = useState(false)
  const [brushPassable, setBrushPassable] = useState(false)
  const [locked, setLocked] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [status, setStatus] = useState('')
  const [thumbMap, setThumbMap] = useState<GameMap | null>(null)   // map for the offscreen preview render on save

  const loadInto = useCallback((data: MapData) => {
    setHalf(data.half)
    setFloorColor(data.floorColor)
    setWallColor(wallColorOf(data))
    setSpawns(data.spawns)
    setShowGridInGame(data.showBlockGrid === true)
    setVoxels(voxelize(data.blocks))
  }, [])

  // Load the map by route name (missing = new empty map with this id).
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

  // Spawn — a half-grid-snapped point (X/Z from the scene), at eye level.
  const onSpawn = useCallback((idx: 0 | 1, x: number, z: number, surfaceY: number) => {
    setSpawns(prev => {
      const next: [Vec3, Vec3] = [prev[0], prev[1]]
      next[idx] = [x, surfaceY + EYE_HEIGHT, z]   // eyes at body height above the surface (floor or cube top)
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
    toMapData(voxels, { half, floorColor, wallColor, spawns, id: name, showBlockGrid: showGridInGame })

  // Saving writes 3 artifacts: raw.json (source) + geo.json (compiled geometry) + preview.png (offscreen render).
  const doSave = async () => {
    setStatus('saving…')
    const data = buildMap()
    const rawOk = await saveMap(name, data)
    const geoOk = await saveCompiled(name, serializeGeo(compileBlocks(data.blocks)))
    setStatus(rawOk && geoOk ? 'rendering preview…' : 'save error')
    setThumbMap(data as unknown as GameMap)   // mounts ThumbnailRenderer → onThumb
  }

  const onThumb = async (dataUrl: string | null) => {
    const pngOk = dataUrl ? await saveThumbnail(name, dataUrl) : false
    setThumbMap(null)
    setStatus(pngOk ? `saved: ${name}` : 'saved (no preview)')
  }

  const count = voxels.size

  if (!loaded) {
    return <div className="editor-root" style={{ color: 'var(--accent)', fontFamily: 'var(--ui-font)', padding: 20 }}>Loading map "{name}"…</div>
  }

  return (
    <div className="editor-root">
      <Canvas shadows camera={{ fov: 75, position: [0, 6, 26], near: 0.1, far: 400 }}>
        <EditorScene
          voxels={voxels}
          half={half} floorColor={floorColor} wallColor={wallColor} spawns={spawns}
          tool={tool} fly={fly} wedgeRot={wedgeRot} wedgeFlip={wedgeFlip} showCubeGrid={showCubeGrid} color={color}
          brushBeam={brushBeam} brushTransparent={brushTransparent} brushPassable={brushPassable}
          onPlace={onPlace} onRemove={onRemove} onSpawn={onSpawn}
        />
      </Canvas>

      {/* Crosshair */}
      <div className="editor-crosshair" />

      {!locked && <div className="editor-hint">CLICK — capture mouse · LMB place · RMB remove{tool === 'wedge' ? ' · R — rotate, T — flip wedge' : ''} · WASD — move, Space — {fly ? 'up' : 'jump'} · TAB — {fly ? 'fly' : 'walk'} · L — cube edges: {showCubeGrid ? 'on' : 'off'} · ESC — menu</div>}

      {/* Hotbar: tools (cube/wedge/spawns) + block color palette */}
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
        <span className="editor-sep" />
        {/* Brush properties: apply to the next placed blocks */}
        <button className={`seg${!brushTransparent ? ' seg--on' : ''}`} data-testid="ed-opaque" onClick={() => setBrushTransparent(v => !v)}>
          {brushTransparent ? 'Semi-transparent' : 'Opaque'}
        </button>
        <button className={`seg${brushBeam ? ' seg--on' : ''}`} data-testid="ed-beam" onClick={() => setBrushBeam(v => !v)}>
          {brushBeam ? 'Beam-blocking' : 'Shoot-through'}
        </button>
        <button className={`seg${!brushPassable ? ' seg--on' : ''}`} data-testid="ed-passable" onClick={() => setBrushPassable(v => !v)}>
          {brushPassable ? 'Passable' : 'Solid'}
        </button>
      </div>

      {/* Side panel */}
      <div className="editor-panel">
        <div className="editor-title">MAP EDITOR <span className="editor-dim">blocks: {count}</span></div>

        <div className="editor-row"><span>MAP</span>
          <span className="editor-name">{name}</span>
        </div>

        <div className="editor-row"><span>ARENA X</span>
          <input className="input" type="number" value={half[0]} min={4} onChange={e => setHalf([Math.max(4, +e.target.value), half[1]])} />
          <span>Z</span>
          <input className="input" type="number" value={half[1]} min={4} onChange={e => setHalf([half[0], Math.max(4, +e.target.value)])} />
        </div>

        <div className="editor-row"><span>FLOOR</span><Palette value={floorColor} onPick={setFloorColor} /></div>
        <div className="editor-row"><span>WALLS</span><Palette value={wallColor} onPick={setWallColor} /></div>

        <div className="editor-row"><span>CUBE GRID</span>
          <button className={`seg${showGridInGame ? ' seg--on' : ''}`} data-testid="ed-map-grid" onClick={() => setShowGridInGame(v => !v)}>
            in game: {showGridInGame ? 'on' : 'off'}
          </button>
        </div>

        <div className="editor-row">
          <button className="btn" onClick={doSave}>SAVE</button>
          {status && <span className="editor-dim">{status}</span>}
        </div>

        <a className="editor-exit" href="#editor">← to map list</a>
      </div>

      {/* Offscreen preview render on save (preview.png) */}
      {thumbMap && <ThumbnailRenderer map={thumbMap} onCapture={onThumb} />}
    </div>
  )
}
