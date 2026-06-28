import { useEffect, useRef, useState, type DragEvent, type KeyboardEvent, type MouseEvent as ReactMouse } from 'react'
import { useT } from '../i18n'
import { RadioVisualizer } from './RadioVisualizer'
import type { IStrudelEngine } from '../radio/music/IStrudelEngine'
import type { RadioLibrary, LibEntry, TrackPayload } from '../radio/library/radioLibrary'
import './RadioExplorer.css'

// Drag-and-drop payload channels. A track SAVED (from the player) travels as a full payload; an internal MOVE
// travels as a JSON array of library paths (one or many — multi-select).
export const DT_TRACK = 'application/x-radio-track' // JSON TrackPayload
export const DT_MOVE = 'text/x-radio-move'          // JSON string[] of library paths

const W0 = 612, H0 = 372, MIN_W = 380, MIN_H = 260

interface RadioExplorerProps {
  lib: RadioLibrary
  rootAbsPath: string
  reloadKey: number
  onPlay: (queue: TrackPayload[], startIndex: number) => void
  onMinimize: () => void              // collapse → the parent shows a "LIBRARY" bar above the player
  hidden: boolean                     // minimized: kept MOUNTED (so state persists) but faded out + non-interactive
  engine: IStrudelEngine | null
  active: boolean
}

type Ctx = { x: number; y: number; entry: LibEntry | null }

export function RadioExplorer({ lib, rootAbsPath, reloadKey, onPlay, onMinimize, hidden, engine, active }: RadioExplorerProps) {
  const t = useT()
  const [path, setPath] = useState('')
  const [entries, setEntries] = useState<LibEntry[]>([])
  const [hist, setHist] = useState<string[]>([])
  const [sel, setSel] = useState<Set<string>>(new Set())  // selected paths (multi-select)
  const [anchor, setAnchor] = useState<string | null>(null) // shift-range anchor
  const [ctx, setCtx] = useState<Ctx | null>(null)
  const [renaming, setRenaming] = useState<string | null>(null)
  const [dropFolder, setDropFolder] = useState<string | null>(null)
  const [clip, setClip] = useState<string[]>([])
  const [bump, setBump] = useState(0)
  const [geo, setGeo] = useState(() => ({ x: Math.round(window.innerWidth / 2 - W0 / 2 + 170), y: Math.round(window.innerHeight * 0.44 - H0 / 2), w: W0, h: H0 }))
  const [win, setWin] = useState<'normal' | 'max'>('normal')
  const [live, setLive] = useState(false) // dragging/resizing → suspend the geometry transition (else the window lags the cursor)
  const [marquee, setMarquee] = useState<{ x0: number; y0: number; x1: number; y1: number } | null>(null)
  const [copied, setCopied] = useState(false) // brief ✓ flash after clicking the address bar to copy the path
  const gridRef = useRef<HTMLDivElement>(null)
  const refresh = () => setBump((b) => b + 1)
  const clearSel = () => { setSel(new Set()); setAnchor(null) }

  useEffect(() => {
    let alive = true
    lib.listDir(path).then((e) => { if (alive) setEntries(e) }).catch(() => { if (alive) setEntries([]) })
    return () => { alive = false }
  }, [lib, path, reloadKey, bump])

  useEffect(() => {
    if (!ctx) return
    const close = () => setCtx(null)
    const id = setTimeout(() => window.addEventListener('pointerdown', close), 0)
    return () => { clearTimeout(id); window.removeEventListener('pointerdown', close) }
  }, [ctx])

  const folders = entries.filter((e) => e.kind === 'folder')
  const tracks = entries.filter((e) => e.kind === 'track')
  const ordered = [...folders, ...tracks]
  const dirName = path ? path.slice(path.lastIndexOf('/') + 1) : t.radioLibrary
  const absPath = rootAbsPath + (path ? '\\' + path.replace(/\//g, '\\') : '')

  const toFiles = (p: string) => { setPath(p); clearSel() }
  const navInto = (folder: string) => { setHist((h) => [...h, path]); toFiles(folder) }
  const goUp = () => { if (path) toFiles(path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : '') }
  const goBack = () => { if (!hist.length) return; setPath(hist[hist.length - 1]); setHist(hist.slice(0, -1)); clearSel() }
  const goHome = () => { setHist((h) => (path ? [...h, path] : h)); toFiles('') }

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
  async function doDeleteSel() { for (const e of entries.filter((x) => sel.has(x.path))) await lib.deleteTrack(e.path, e.kind === 'folder'); clearSel(); refresh() }
  function doCopySel() { setClip(tracks.filter((e) => sel.has(e.path)).map((e) => e.path)) }
  async function doPaste() { for (const src of clip) { const p = await lib.readTrack(src); await lib.saveTrack(path, p) } refresh() }
  async function commitRename(e: LibEntry, name: string) {
    setRenaming(null)
    if (name.trim() && name !== e.name) { await lib.rename(e.path, name.trim()); refresh() }
  }

  // click selection: plain = single, Ctrl/Cmd = toggle, Shift = range (in display order)
  function clickItem(ev: ReactMouse, e: LibEntry) {
    ev.stopPropagation()
    const paths = ordered.map((o) => o.path)
    if (ev.shiftKey && anchor) {
      const a = paths.indexOf(anchor), b = paths.indexOf(e.path)
      if (a >= 0 && b >= 0) { const lo = Math.min(a, b), hi = Math.max(a, b); setSel(new Set(paths.slice(lo, hi + 1))) }
    } else if (ev.ctrlKey || ev.metaKey) {
      setSel((s) => { const n = new Set(s); if (n.has(e.path)) n.delete(e.path); else n.add(e.path); return n }); setAnchor(e.path)
    } else { setSel(new Set([e.path])); setAnchor(e.path) }
  }

  // keyboard shortcuts (the ones shown in the context menu): F2 rename, Del delete, Ctrl+C copy, Ctrl+V paste
  useEffect(() => {
    const onKey = (ev: globalThis.KeyboardEvent) => {
      const tag = (ev.target as HTMLElement | null)?.tagName
      if (renaming || tag === 'INPUT' || tag === 'TEXTAREA') return
      if (ev.key === 'F2' && sel.size === 1) { ev.preventDefault(); setRenaming([...sel][0]) }
      else if (ev.key === 'Delete' && sel.size) { ev.preventDefault(); void doDeleteSel() }
      else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'c' && sel.size) { ev.preventDefault(); doCopySel() }
      else if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === 'v' && clip.length) { ev.preventDefault(); void doPaste() }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sel, clip, renaming, entries, path])

  function onDragStartTrack(ev: DragEvent, e: LibEntry) {
    const paths = sel.has(e.path) ? [...sel] : [e.path]
    if (!sel.has(e.path)) { setSel(new Set([e.path])); setAnchor(e.path) }
    ev.dataTransfer.setData(DT_MOVE, JSON.stringify(paths))
    ev.dataTransfer.effectAllowed = 'copyMove'
  }
  function onDropTo(ev: DragEvent, folder: string) {
    ev.preventDefault(); setDropFolder(null)
    const track = ev.dataTransfer.getData(DT_TRACK)
    const move = ev.dataTransfer.getData(DT_MOVE)
    if (track) { try { void lib.saveTrack(folder, JSON.parse(track) as TrackPayload).then(refresh) } catch { /* bad payload */ } }
    else if (move) {
      try {
        const ps = (JSON.parse(move) as string[]).filter((p) => {
          const parent = p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : ''
          return parent !== folder && p !== folder && !folder.startsWith(p + '/') // skip same-folder / self / own-descendant
        })
        if (ps.length) void Promise.all(ps.map((p) => lib.moveTrack(p, folder))).then(refresh)
      } catch { /* bad list */ }
    }
  }

  type MItem = { label: string; k: string; acc?: string; danger?: boolean; dis?: boolean; act: () => void }
  const menu = (c: Ctx): MItem[] => {
    const e = c.entry, items: MItem[] = []
    if (e) items.push({ label: t.radioCtxPlay, k: '▶', act: () => (e.kind === 'folder' ? void playFolder(e.path) : void playTrack(e.path)) })
    items.push({ label: t.radioCtxNewFolder, k: '＋', act: () => void doNewFolder() })
    if (e && sel.size <= 1) items.push({ label: t.radioCtxRename, k: '✎', acc: 'F2', act: () => setRenaming(e.path) })
    if (tracks.some((x) => sel.has(x.path))) items.push({ label: t.radioCtxCopy, k: '⧉', acc: 'Ctrl+C', act: () => doCopySel() })
    items.push({ label: t.radioCtxPaste, k: '📋', acc: 'Ctrl+V', dis: !clip.length, act: () => void doPaste() })
    if (sel.size) items.push({ label: t.radioCtxDelete, k: '🗑', acc: 'Del', danger: true, act: () => void doDeleteSel() })
    return items
  }

  function startGeo(e: ReactMouse, mode: 'move' | 'resize') {
    e.preventDefault(); setLive(true)
    const sx = e.clientX, sy = e.clientY, g0 = { ...geo }
    const onMove = (ev: globalThis.MouseEvent) => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy
      if (mode === 'move') setGeo({ ...g0, x: g0.x + dx, y: g0.y + dy })
      else setGeo({ ...g0, w: Math.max(MIN_W, g0.w + dx), h: Math.max(MIN_H, g0.h + dy) })
    }
    const onUp = () => { setLive(false); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }

  // Windows-style rubber-band: press on empty grid space and drag a box → selects every icon it touches.
  function startMarquee(e: ReactMouse) {
    if (e.button !== 0 || (e.target as HTMLElement).closest('.rexp-it')) return
    const x0 = e.clientX, y0 = e.clientY
    const baseSel = e.ctrlKey || e.metaKey ? new Set(sel) : new Set<string>()
    setSel(baseSel); setAnchor(null); setMarquee({ x0, y0, x1: x0, y1: y0 })
    const onMove = (ev: globalThis.MouseEvent) => {
      setMarquee({ x0, y0, x1: ev.clientX, y1: ev.clientY })
      const grid = gridRef.current; if (!grid) return
      const L = Math.min(x0, ev.clientX), R = Math.max(x0, ev.clientX), T = Math.min(y0, ev.clientY), B = Math.max(y0, ev.clientY)
      const hit = new Set(baseSel)
      grid.querySelectorAll<HTMLElement>('[data-path]').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (!(r.right < L || r.left > R || r.bottom < T || r.top > B)) { const p = el.dataset.path; if (p) hit.add(p) }
      })
      setSel(hit)
    }
    const onUp = () => { setMarquee(null); document.removeEventListener('mousemove', onMove); document.removeEventListener('mouseup', onUp) }
    document.addEventListener('mousemove', onMove); document.addEventListener('mouseup', onUp)
  }

  const renderItem = (e: LibEntry) => (
    <div key={e.path} data-testid={`rexp-${e.kind}`} data-path={e.path}
      className={`rexp-it${sel.has(e.path) ? ' sel' : ''}${dropFolder === e.path ? ' dropok' : ''}`}
      draggable={e.kind === 'track' && renaming !== e.path}
      onDragStart={(ev) => { if (e.kind === 'track') onDragStartTrack(ev, e) }}
      onDragOver={(ev) => { if (e.kind === 'folder') { ev.preventDefault(); setDropFolder(e.path) } }}
      onDragLeave={() => e.kind === 'folder' && setDropFolder((d) => (d === e.path ? null : d))}
      onDrop={(ev) => { if (e.kind === 'folder') { ev.stopPropagation(); onDropTo(ev, e.path) } }}
      onClick={(ev) => clickItem(ev, e)}
      onDoubleClick={() => openEntry(e)}
      onContextMenu={(ev) => { ev.preventDefault(); ev.stopPropagation(); if (!sel.has(e.path)) { setSel(new Set([e.path])); setAnchor(e.path) } setCtx({ x: ev.clientX, y: ev.clientY, entry: e }) }}>
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

  const maxed = win === 'max'
  return (
    <>
      <div className={`rexp${live ? '' : ' anim'}${hidden ? ' hidden' : ''}`} data-testid="radio-explorer"
        style={maxed
          ? { left: 8, top: 8, width: 'calc(100vw - 16px)', height: 'calc(100vh - 16px)' }
          : { left: geo.x, top: geo.y, width: geo.w, height: geo.h }}
        onContextMenu={(ev) => { ev.preventDefault(); clearSel(); setCtx({ x: ev.clientX, y: ev.clientY, entry: null }) }}>
        <RadioVisualizer engine={engine} active={active && !hidden} />
        <div className="rexp-title" onMouseDown={(e) => { if (!maxed && !(e.target as HTMLElement).closest('.rexp-wbtn')) startGeo(e, 'move') }}>
          <b>{dirName}</b><span style={{ flex: 1 }} />
          <span className="rexp-wbtn" onClick={onMinimize}>_</span>
          <span className="rexp-wbtn" onClick={() => setWin((w) => (w === 'max' ? 'normal' : 'max'))}>▢</span>
          <span className="rexp-wbtn x" onClick={onMinimize}>✕</span></div>
        <div className="rexp-tools">
          <button className="rexp-tb" onClick={goBack} disabled={!hist.length} aria-label="back">◀</button>
          <button className="rexp-tb" onClick={goUp} disabled={!path} aria-label="up">▲</button>
          <button className="rexp-tb home" onClick={goHome} aria-label={t.radioHome}>⌂</button>
        </div>
        <div className="rexp-addr">
          <div className={`field${copied ? ' copied' : ''}`} title={t.radioCtxCopy}
            onClick={() => { void navigator.clipboard?.writeText(absPath); setCopied(true); window.setTimeout(() => setCopied(false), 1100) }}>{absPath}</div>
          {copied && <span className="rexp-copied">✓</span>}
        </div>
        <div className="rexp-grid" ref={gridRef} onMouseDown={startMarquee}
          onDragOver={(ev) => ev.preventDefault()}
          onDrop={(ev) => onDropTo(ev, path)}>
          {folders.map(renderItem)}{tracks.map(renderItem)}
        </div>
        <div className="rexp-status">{entries.length} {t.radioItems} · {folders.length} {t.radioFolders}{sel.size > 1 && ` · ${sel.size} ✓`}</div>
        {!maxed && <div className="rexp-resize" onMouseDown={(e) => startGeo(e, 'resize')} />}
      </div>

      {marquee && !hidden && (
        <div className="rexp-marquee" style={{
          left: Math.min(marquee.x0, marquee.x1), top: Math.min(marquee.y0, marquee.y1),
          width: Math.abs(marquee.x1 - marquee.x0), height: Math.abs(marquee.y1 - marquee.y0),
        }} />
      )}

      {!hidden && ctx && (
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
