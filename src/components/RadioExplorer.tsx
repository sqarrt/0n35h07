import { useEffect, useState, type DragEvent, type KeyboardEvent, type MouseEvent as ReactMouse } from 'react'
import { useT } from '../i18n'
import { RadioVisualizer } from './RadioVisualizer'
import type { IStrudelEngine } from '../radio/music/IStrudelEngine'
import type { RadioLibrary, LibEntry, TrackPayload } from '../radio/library/radioLibrary'
import './RadioExplorer.css'

// Drag-and-drop payload channels. A track being SAVED (from the player, or copied) travels as a full payload;
// an internal file MOVE travels as its library path.
export const DT_TRACK = 'application/x-radio-track' // JSON TrackPayload
export const DT_MOVE = 'text/x-radio-move'          // a library file path

const W0 = 612, H0 = 372, MIN_W = 380, MIN_H = 260

interface RadioExplorerProps {
  lib: RadioLibrary
  rootAbsPath: string                 // OS path of the radio root — shown in the address bar
  reloadKey: number                   // bump to refresh after an external save/trash
  trashSignal: number                 // bump to open the trash view (double-click on the bin)
  onPlay: (queue: TrackPayload[], startIndex: number) => void
  onRestore: (id: string) => void     // un-block a track (so the generator may produce it again)
  engine: IStrudelEngine | null       // for the audio-reactive visualizer (the window's living background)
  active: boolean
}

type TrashItem = { id: string; name: string }
type Ctx = { x: number; y: number; entry: LibEntry | null; trash: TrashItem | null }

export function RadioExplorer({ lib, rootAbsPath, reloadKey, trashSignal, onPlay, onRestore, engine, active }: RadioExplorerProps) {
  const t = useT()
  const [path, setPath] = useState('')
  const [trashMode, setTrashMode] = useState(false)
  const [entries, setEntries] = useState<LibEntry[]>([])
  const [trashItems, setTrashItems] = useState<TrashItem[]>([])
  const [hist, setHist] = useState<string[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dropFolder, setDropFolder] = useState<string | null>(null)
  const [clip, setClip] = useState<string | null>(null)
  const [bump, setBump] = useState(0)
  const [geo, setGeo] = useState(() => ({ x: Math.round(window.innerWidth / 2 - W0 / 2 + 170), y: Math.round(window.innerHeight * 0.44 - H0 / 2), w: W0, h: H0 }))
  const [win, setWin] = useState<'normal' | 'min' | 'max'>('normal') // minimize/close → 'min' (bar above player); maximize → 'max'
  const refresh = () => setBump((b) => b + 1)

  useEffect(() => {
    let alive = true
    if (trashMode) lib.trashEntries().then((e) => { if (alive) setTrashItems(e) }).catch(() => { if (alive) setTrashItems([]) })
    else lib.listDir(path).then((e) => { if (alive) setEntries(e) }).catch(() => { if (alive) setEntries([]) })
    return () => { alive = false }
  }, [lib, path, trashMode, reloadKey, bump])

  // The trash bin was double-clicked → open the trash view.
  useEffect(() => { if (trashSignal > 0) { setTrashMode(true); setWin('normal'); setSel(null); setCtx(null) } }, [trashSignal])

  // Close the context menu on the NEXT outside click (deferred a tick so the opening right-click can't close it).
  useEffect(() => {
    if (!ctx) return
    const close = () => setCtx(null)
    const id = setTimeout(() => window.addEventListener('pointerdown', close), 0)
    return () => { clearTimeout(id); window.removeEventListener('pointerdown', close) }
  }, [ctx])

  const folders = entries.filter((e) => e.kind === 'folder')
  const tracks = entries.filter((e) => e.kind === 'track')
  const dirName = trashMode ? t.radioTrash : (path ? path.slice(path.lastIndexOf('/') + 1) : t.radioLibrary)
  const absPath = trashMode ? `🗑 ${t.radioTrash}` : rootAbsPath + (path ? '\\' + path.replace(/\//g, '\\') : '')

  const toFiles = (p: string) => { setTrashMode(false); setPath(p); setSel(null) }
  const navInto = (folder: string) => { setHist((h) => [...h, path]); toFiles(folder) }
  const goUp = () => { if (trashMode) return toFiles(''); if (path) toFiles(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '') }
  const goBack = () => { if (trashMode) return toFiles(path); if (!hist.length) return; setPath(hist[hist.length - 1]); setHist(hist.slice(0, -1)); setSel(null) }
  const goHome = () => { setHist((h) => (path && !trashMode ? [...h, path] : h)); toFiles('') }

  async function playTrack(file: string) {
    const payloads = await Promise.all(tracks.map((e) => lib.readTrack(e.path)))
    const idx = tracks.findIndex((e) => e.path === file)
    if (idx >= 0) onPlay(payloads, idx)
  }
  async function playFolder(folder: string) {
    const inside = (await lib.listDir(folder)).filter((e) => e.kind === 'track')
    const payloads = await Promise.all(inside.map((e) => lib.readTrack(e.path)))
    if (payloads.length) onPlay(payloads, 0)
  }
  const openEntry = (e: LibEntry) => { if (e.kind === 'folder') navInto(e.path); else void playTrack(e.path) }

  async function doNewFolder() { await lib.makeFolder(path, t.radioCtxNewFolder); refresh() }
  async function doDelete(e: LibEntry) { await lib.deleteTrack(e.path, e.kind === 'folder'); refresh() }
  async function doPaste() { if (!clip) return; const p = await lib.readTrack(clip); await lib.saveTrack(path, p); refresh() }
  async function doRestore(id: string) { await lib.trashRemove(id); onRestore(id); refresh() }
  async function commitRename(e: LibEntry, name: string) {
    setRenaming(null)
    if (name.trim() && name !== e.name) { await lib.rename(e.path, name.trim()); refresh() }
  }

  function onDropFolder(ev: DragEvent, folder: string) {
    ev.preventDefault(); setDropFolder(null)
    const track = ev.dataTransfer.getData(DT_TRACK)
    const move = ev.dataTransfer.getData(DT_MOVE)
    if (track) { try { void lib.saveTrack(folder, JSON.parse(track) as TrackPayload).then(refresh) } catch { /* bad payload */ } }
    else if (move && move !== folder && !move.startsWith(folder + '/')) void lib.moveTrack(move, folder).then(refresh)
  }

  type MItem = { label: string; k: string; acc?: string; danger?: boolean; dis?: boolean; act: () => void }
  const menu = (c: Ctx): MItem[] => {
    if (c.trash) return [{ label: t.radioRestore, k: '↺', act: () => void doRestore(c.trash!.id) }]
    const e = c.entry, items: MItem[] = []
    if (e) items.push({ label: t.radioCtxPlay, k: '▶', act: () => (e.kind === 'folder' ? void playFolder(e.path) : void playTrack(e.path)) })
    items.push({ label: t.radioCtxNewFolder, k: '＋', act: () => void doNewFolder() })
    if (e) {
      items.push({ label: t.radioCtxRename, k: '✎', acc: 'F2', act: () => setRenaming(e.path) })
      if (e.kind === 'track') items.push({ label: t.radioCtxCopy, k: '⧉', acc: 'Ctrl+C', act: () => setClip(e.path) })
    }
    items.push({ label: t.radioCtxPaste, k: '📋', acc: 'Ctrl+V', dis: !clip, act: () => void doPaste() })
    if (e) items.push({ label: t.radioCtxDelete, k: '🗑', acc: 'Del', danger: true, act: () => void doDelete(e) })
    return items
  }

  // ── window move / resize ──
  function startGeo(e: ReactMouse, mode: 'move' | 'resize') {
    e.preventDefault()
    const sx = e.clientX, sy = e.clientY, g0 = { ...geo }
    const onMove = (ev: globalThis.MouseEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy
      if (mode === 'move') setGeo({ ...g0, x: g0.x + dx, y: g0.y + dy })
      else setGeo({ ...g0, w: Math.max(MIN_W, g0.w + dx), h: Math.max(MIN_H, g0.h + dy) })
    }
    const onUp = () => { document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }

  const renderItem = (e: LibEntry) => (
    <div key={e.path} data-testid={`rexp-${e.kind}`}
      className={`rexp-it${sel === e.path ? ' sel' : ''}${dropFolder === e.path ? ' dropok' : ''}`}
      draggable={e.kind === 'track' && renaming !== e.path}
      onDragStart={(ev) => { if (e.kind === 'track') { ev.dataTransfer.setData(DT_MOVE, e.path); ev.dataTransfer.effectAllowed = 'copyMove' } }}
      onDragOver={(ev) => { if (e.kind === 'folder') { ev.preventDefault(); setDropFolder(e.path) } }}
      onDragLeave={() => e.kind === 'folder' && setDropFolder((d) => (d === e.path ? null : d))}
      onDrop={(ev) => { if (e.kind === 'folder') { ev.stopPropagation(); onDropFolder(ev, e.path) } }}
      onClick={(ev) => { ev.stopPropagation(); setSel(e.path) }}
      onDoubleClick={() => openEntry(e)}
      onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setSel(e.path); setCtx({ x: ev.clientX, y: ev.clientY, entry: e, trash: null }) }}>
      <div className={e.kind === 'folder' ? 'rexp-folder' : 'rexp-cass'}>
        {e.kind === 'track' && <><span className="reel l" /><span className="reel r" /></>}
      </div>
      {renaming === e.path
        ? <input className="rexp-rename" autoFocus defaultValue={e.name}
            onBlur={(ev) => void commitRename(e, ev.target.value)}
            onKeyDown={(ev: KeyboardEvent<HTMLInputElement>) => { if (ev.key === 'Enter') (ev.target as HTMLInputElement).blur(); if (ev.key === 'Escape') setRenaming(null) }} />
        : <div className="lbl">{e.name}</div>}
    </div>
  )
  const renderTrash = (it: TrashItem) => (
    <div key={it.id} className="rexp-it trash" onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setCtx({ x: ev.clientX, y: ev.clientY, entry: null, trash: it }) }}>
      <div className="rexp-cass dead"><span className="reel l" /><span className="reel r" /></div>
      <div className="lbl">{it.name}</div>
    </div>
  )

  const count = trashMode ? trashItems.length : entries.length
  if (win === 'min') return (
    <div className="rexp-min" data-testid="radio-explorer-min" onClick={() => setWin('normal')} title={t.radioLibrary}>
      <span className="rexp-min-ic">▣</span> {dirName}
    </div>
  )
  const maxed = win === 'max'
  return (
    <>
      <div className="rexp" data-testid="radio-explorer"
        style={maxed
          ? { left: 10, top: 10, width: 'calc(100vw - 20px)', height: 'calc(100vh - 240px)', transform: 'none' }
          : { left: geo.x, top: geo.y, width: geo.w, height: geo.h, transform: 'none' }}
        onContextMenu={(ev) => { if (!trashMode) { ev.preventDefault(); setCtx({ x: ev.clientX, y: ev.clientY, entry: null, trash: null }) } }}>
        <RadioVisualizer engine={engine} active={active} />
        <div className="rexp-title" onMouseDown={(e) => { if (!maxed && !(e.target as HTMLElement).closest('.rexp-wbtn')) startGeo(e, 'move') }}>
          <span className="dot" /><b>{dirName}</b><span style={{ flex: 1 }} />
          <span className="rexp-wbtn" onClick={() => setWin('min')}>_</span>
          <span className="rexp-wbtn" onClick={() => setWin((w) => (w === 'max' ? 'normal' : 'max'))}>▢</span>
          <span className="rexp-wbtn x" onClick={() => setWin('min')}>✕</span></div>
        <div className="rexp-tools">
          <button className="rexp-tb" onClick={goBack} disabled={!trashMode && !hist.length} aria-label="back">◀</button>
          <button className="rexp-tb" onClick={goUp} disabled={!trashMode && !path} aria-label="up">▲</button>
          <button className="rexp-tb home" onClick={goHome} aria-label={t.radioHome}>⌂</button>
        </div>
        <div className="rexp-addr"><span className="lab">{t.radioPath}:</span><div className="field">{absPath}</div></div>
        <div className="rexp-grid" onClick={() => setSel(null)}
          onDragOver={(ev) => { if (!trashMode) ev.preventDefault() }}
          onDrop={(ev) => { if (!trashMode) onDropFolder(ev, path) }}>
          {trashMode ? trashItems.map(renderTrash) : <>{folders.map(renderItem)}{tracks.map(renderItem)}</>}
        </div>
        <div className="rexp-status">{count} {t.radioItems}{!trashMode && ` · ${folders.length} ${t.radioFolders}`}</div>
        {!maxed && <div className="rexp-resize" onMouseDown={(e) => startGeo(e, 'resize')} />}
      </div>

      {ctx && (
        <div className="rexp-ctx" style={{ left: Math.min(ctx.x, window.innerWidth - 220), top: ctx.y }} onPointerDown={(e) => e.stopPropagation()}>
          {menu(ctx).map((m, i) => (
            <div key={i} className={`rexp-mi${m.danger ? ' danger' : ''}${m.dis ? ' dis' : ''}`}
              onClick={() => { if (!m.dis) { m.act(); setCtx(null) } }}>
              <span className="k">{m.k}</span> {m.label}{m.acc && <span className="acc">{m.acc}</span>}
            </div>
          ))}
        </div>
      )}
    </>
  )
}
