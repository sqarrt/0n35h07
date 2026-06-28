import { useEffect, useState, type DragEvent, type KeyboardEvent } from 'react'
import { useT } from '../i18n'
import type { RadioLibrary, LibEntry, TrackPayload } from '../radio/library/radioLibrary'
import './RadioExplorer.css'

// Drag-and-drop payload channels. A track being SAVED (from the player, or copied) travels as a full payload;
// an internal file MOVE travels as its library path.
export const DT_TRACK = 'application/x-radio-track' // JSON TrackPayload
export const DT_MOVE = 'text/x-radio-move'          // a library file path

interface RadioExplorerProps {
  lib: RadioLibrary
  rootAbsPath: string                 // OS path of the radio root — shown in the address bar
  reloadKey: number                   // bump from the parent to refresh after an external save/trash
  onPlay: (queue: TrackPayload[], startIndex: number) => void
}

type Ctx = { x: number; y: number; entry: LibEntry | null }

export function RadioExplorer({ lib, rootAbsPath, reloadKey, onPlay }: RadioExplorerProps) {
  const t = useT()
  const [path, setPath] = useState('')
  const [entries, setEntries] = useState<LibEntry[]>([])
  const [hist, setHist] = useState<string[]>([])
  const [sel, setSel] = useState<string | null>(null)
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dropFolder, setDropFolder] = useState<string | null>(null)
  const [clip, setClip] = useState<string | null>(null) // copied track's path
  const [bump, setBump] = useState(0)
  const refresh = () => setBump((b) => b + 1)

  useEffect(() => {
    let alive = true
    lib.listDir(path).then((e) => { if (alive) setEntries(e) }).catch(() => { if (alive) setEntries([]) })
    return () => { alive = false }
  }, [lib, path, reloadKey, bump])

  useEffect(() => {
    if (!ctx) return
    const close = () => setCtx(null)
    window.addEventListener('pointerdown', close)
    return () => window.removeEventListener('pointerdown', close)
  }, [ctx])

  const folders = entries.filter((e) => e.kind === 'folder')
  const tracks = entries.filter((e) => e.kind === 'track')
  const dirName = path ? path.slice(path.lastIndexOf('/') + 1) : t.radioLibrary
  const absPath = rootAbsPath + (path ? '\\' + path.replace(/\//g, '\\') : '')

  const navInto = (folder: string) => { setHist((h) => [...h, path]); setPath(folder); setSel(null) }
  const goUp = () => { if (path) { setPath(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''); setSel(null) } }
  const goBack = () => { if (!hist.length) return; setPath(hist[hist.length - 1]); setHist(hist.slice(0, -1)); setSel(null) }
  const goHome = () => { setHist((h) => (path ? [...h, path] : h)); setPath(''); setSel(null) }

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
  async function commitRename(e: LibEntry, name: string) {
    setRenaming(null)
    if (name.trim() && name !== e.name) { await lib.rename(e.path, name.trim()); refresh() }
  }

  function onDragStartTrack(ev: DragEvent, file: string) {
    ev.dataTransfer.setData(DT_MOVE, file)
    ev.dataTransfer.effectAllowed = 'copyMove'
  }
  function onDropFolder(ev: DragEvent, folder: string) {
    ev.preventDefault(); setDropFolder(null)
    const track = ev.dataTransfer.getData(DT_TRACK)
    const move = ev.dataTransfer.getData(DT_MOVE)
    if (track) { try { void lib.saveTrack(folder, JSON.parse(track) as TrackPayload).then(refresh) } catch { /* bad payload */ } }
    else if (move && move !== folder && !move.startsWith(folder + '/')) void lib.moveTrack(move, folder).then(refresh)
  }

  const menu = (e: LibEntry | null): { label: string; k: string; acc?: string; danger?: boolean; dis?: boolean; act: () => void }[] => {
    const items = []
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

  const renderItem = (e: LibEntry) => {
    return (
      <div key={e.path} data-testid={`rexp-${e.kind}`}
        className={`rexp-it${sel === e.path ? ' sel' : ''}${dropFolder === e.path ? ' dropok' : ''}`}
        draggable={e.kind === 'track' && renaming !== e.path}
        onDragStart={(ev) => e.kind === 'track' && onDragStartTrack(ev, e.path)}
        onDragOver={(ev) => { if (e.kind === 'folder') { ev.preventDefault(); setDropFolder(e.path) } }}
        onDragLeave={() => e.kind === 'folder' && setDropFolder((d) => (d === e.path ? null : d))}
        onDrop={(ev) => e.kind === 'folder' && onDropFolder(ev, e.path)}
        onClick={(ev) => { ev.stopPropagation(); setSel(e.path) }}
        onDoubleClick={() => openEntry(e)}
        onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); setSel(e.path); setCtx({ x: ev.clientX, y: ev.clientY, entry: e }) }}>
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
  }

  return (
    <div className="rexp" data-testid="radio-explorer" onContextMenu={(ev) => { ev.preventDefault(); setCtx({ x: ev.clientX, y: ev.clientY, entry: null }) }}>
      <div className="rexp-title"><span className="dot" /><b>{dirName}</b><span style={{ flex: 1 }} />
        <span className="rexp-wbtn">_</span><span className="rexp-wbtn">▢</span><span className="rexp-wbtn x">✕</span></div>
      <div className="rexp-tools">
        <button className="rexp-tb" onClick={goBack} disabled={!hist.length} aria-label="back">◀</button>
        <button className="rexp-tb" onClick={goUp} disabled={!path} aria-label="up">▲</button>
        <button className="rexp-tb home" onClick={goHome} aria-label={t.radioHome}>⌂</button>
      </div>
      <div className="rexp-addr"><span className="lab">{t.radioPath}:</span><div className="field">{absPath}</div></div>
      <div className="rexp-grid" onClick={() => setSel(null)}>
        {folders.map(renderItem)}{tracks.map(renderItem)}
      </div>
      <div className="rexp-status">{entries.length} {t.radioItems} · {folders.length} {t.radioFolders}</div>

      {ctx && (
        <div className="rexp-ctx" style={{ left: Math.min(ctx.x, window.innerWidth - 220), top: ctx.y }} onPointerDown={(e) => e.stopPropagation()}>
          {menu(ctx.entry).map((m, i) => (
            <div key={i} className={`rexp-mi${m.danger ? ' danger' : ''}${m.dis ? ' dis' : ''}`}
              onClick={() => { if (!m.dis) { m.act(); setCtx(null) } }}>
              <span className="k">{m.k}</span> {m.label}{m.acc && <span className="acc">{m.acc}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
