import { useRef, useState, type CSSProperties } from 'react'
import { glassCard } from './glass'
import { DT_TRACK } from './RadioExplorer'
import './RadioExplorer.css' // the .rexp-cass cassette icon (reused as the drag image)
import { useT } from '../i18n'
import { fractionFromPointer, fmtMs } from './radioPlayerFmt'

const SCRUB_RAIL_HEIGHT = 4   // px — thin rail; the row height is reserved so nothing jumps
const SCRUB_THUMB = 11        // px — the draggable knob diameter

// Build an off-screen cassette element, snapshot it as the drag image, then drop it (no persistent leak).
function setCassetteDragImage(dt: DataTransfer) {
  const ghost = document.createElement('div')
  ghost.className = 'rexp-cass'
  ghost.style.cssText = 'position:fixed;left:-9999px;top:0'
  ghost.innerHTML = '<span class="reel l"></span><span class="reel r"></span>'
  document.body.appendChild(ghost)
  dt.setDragImage(ghost, 26, 17)
  setTimeout(() => ghost.remove(), 0)
}

export type RadioPlayMode = 'gen' | 'fav'

interface RadioPlayerProps {
  expanded: boolean       // radio screen → full size, centered-bottom; else → shrunk into the bottom-right corner
  ready: boolean
  mode: RadioPlayMode
  playing: boolean
  trackName: string
  subtitle: string
  volume: number
  onMode: (m: RadioPlayMode) => void
  onPrev: () => void
  onNext: () => void
  onPlayPause: () => void
  progress: number               // current play position 0..1 (polled)
  totalMs: number                // current track duration in ms (for the time label)
  onSeek: (frac: number) => void // jump the current track to a fraction
  onDragTrack: () => string | null   // bake the current track to a library payload (drag-to-save)
  onToggleBall: () => void           // hide/show the player ball in radio mode (the camera pans away)
  ballHidden: boolean                // is the ball currently hidden?
  trial?: { gensLeft: number; savesLeft: number } | null // free-trial remaining; null = unlimited/unresolved → no strip
  genLimited?: boolean               // daily free generations spent → show the limit message
  saveLimited?: boolean              // a save was just blocked → transient inline prompt
  onUnlock?: () => void              // open the Steam DLC store overlay
  libraryMin?: boolean               // the explorer is minimized → show a "LIBRARY" bar above the card (same as BACK)
  onRestoreLibrary?: () => void
  codeMin?: boolean                  // the code panel is minimized → show a "PROGRAM" bar above the card
  onRestoreCode?: () => void
  lastMin?: 'lib' | 'code' | null    // which panel minimized LAST → it sits on TOP of the bar stack when both are down
  onVolume: (v: number) => void
  onOpen: () => void
  onBack: () => void
}

const COLLAPSED_SCALE = 0.8

// Anchored bottom-right; expanded → translate to horizontal center & full scale, collapsed → stay in the corner,
// shrunk (transform-origin bottom-right). One transform transition animates the dock↔expand move.
const wrap = (expanded: boolean): CSSProperties => ({
  position: 'fixed', right: 18, bottom: 44, zIndex: 200,   // above .screen (100) and .version-chip (105); clears the version
  pointerEvents: 'auto',
  transformOrigin: 'bottom right',
  transform: expanded ? 'translateX(calc(-50vw + 50% + 18px)) scale(1)' : `translateX(0) scale(${COLLAPSED_SCALE})`,
  transition: 'transform 0.34s cubic-bezier(0.2,0.8,0.2,1)',
  display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8,
  fontFamily: 'var(--ui-font)', color: '#cdd',
})
const card: CSSProperties = { ...glassCard, padding: '12px 16px', width: 300, display: 'flex', flexDirection: 'column', gap: 9 }
const title = (clickable: boolean): CSSProperties => ({
  textAlign: 'center', color: '#eef', letterSpacing: '0.05em', fontSize: '0.92rem',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: clickable ? 'pointer' : 'default',
})
const subRow: CSSProperties = { textAlign: 'center', color: 'var(--accent-dim)', fontSize: '0.7rem', letterSpacing: '0.12em' }
const SCRUB_HIT_HEIGHT = 18   // px — the FULL-height grab area (the visual rail is thin); a 4px target is unhittable
const scrubRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, height: SCRUB_HIT_HEIGHT, fontSize: '0.6rem', color: 'var(--accent-dim)', letterSpacing: '0.04em' }
// The interactive `.scrub` element spans the WHOLE row height so the thin rail is easy to grab; the visual rail is a
// thin child centered inside it (pointerEvents off → the hit area, not the rail, captures the pointer).
const scrubHit: CSSProperties = { position: 'relative', flex: 1, height: SCRUB_HIT_HEIGHT, display: 'flex', alignItems: 'center', cursor: 'pointer', touchAction: 'none' }
const scrubRail: CSSProperties = { position: 'relative', width: '100%', height: SCRUB_RAIL_HEIGHT, borderRadius: SCRUB_RAIL_HEIGHT, background: 'rgba(255,255,255,0.14)', pointerEvents: 'none' }
const scrubFill = (frac: number): CSSProperties => ({ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${frac * 100}%`, borderRadius: SCRUB_RAIL_HEIGHT, background: 'var(--accent, #8cf)' })
const scrubThumb = (frac: number): CSSProperties => ({ position: 'absolute', top: '50%', left: `${frac * 100}%`, width: SCRUB_THUMB, height: SCRUB_THUMB, marginLeft: -SCRUB_THUMB / 2, transform: 'translateY(-50%)', borderRadius: '50%', background: '#eef', pointerEvents: 'none' })
const timeLabel: CSSProperties = { flex: '0 0 auto', minWidth: 30, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }
const center: CSSProperties = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }
// grid+placeItems reliably centers symbol glyphs (flex/baseline left them low).
const iconBtn: CSSProperties = {
  appearance: 'none', background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10,
  width: 42, height: 36, cursor: 'pointer', color: '#cdd', font: 'inherit', fontSize: '1.05rem',
  display: 'grid', placeItems: 'center', lineHeight: 1, padding: 0,
}
const smallBtn: CSSProperties = { ...iconBtn, width: 34, height: 30, fontSize: '0.9rem' }
// Air toggle: lit (green) when the live generative stream is the source; click to return to it.
const airBtn = (on: boolean): CSSProperties => ({
  ...iconBtn, flex: 1, width: 'auto', height: 32, fontSize: '0.72rem', letterSpacing: '0.08em',
  color: on ? 'var(--ok)' : '#bcd', borderColor: on ? 'rgba(68,255,170,0.45)' : 'rgba(255,255,255,0.14)',
  background: on ? 'rgba(68,255,170,0.10)' : 'transparent', boxShadow: on ? '0 0 10px rgba(68,255,170,0.15)' : 'none',
})
const volRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const volLabel: CSSProperties = { color: '#667', fontSize: '0.62rem', letterSpacing: '0.14em', flex: '0 0 auto' }
// Free-trial strip + limit prompt (only shown on the trial; the player width stays fixed so nothing jumps).
const trialRow: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 2, paddingTop: 7, borderTop: '1px solid rgba(255,255,255,0.08)', color: 'var(--accent-dim)', fontSize: '0.66rem', letterSpacing: '0.06em' }
const unlockBtn: CSSProperties = { appearance: 'none', cursor: 'pointer', flex: '0 0 auto', padding: '3px 10px', borderRadius: 8, border: '1px solid rgba(68,170,255,0.45)', background: 'rgba(68,170,255,0.12)', color: '#bcd', font: 'inherit', fontSize: '0.62rem', letterSpacing: '0.06em' }
const limitMsg: CSSProperties = { textAlign: 'center', color: '#e9a', fontSize: '0.64rem', letterSpacing: '0.04em', marginTop: 2 }
const backBtn: CSSProperties = {
  ...glassCard, appearance: 'none', cursor: 'pointer', padding: '9px 0',
  color: '#cdd', font: 'inherit', fontFamily: 'var(--ui-font)', fontSize: '0.74rem', letterSpacing: '0.16em', textAlign: 'center',
}

/** Unified radio player. Expanded (centered-bottom) on the Radio screen; docked (shrunk, still interactive) in the
 *  bottom-right corner — collapsed shows only the track name + transport. Desktop-only (gate at the call site). */
export function RadioPlayer(p: RadioPlayerProps) {
  const t = useT()
  const cardRef = useRef<HTMLDivElement>(null)
  const railRef = useRef<HTMLDivElement>(null)
  const [dragFrac, setDragFrac] = useState<number | null>(null)
  const shownFrac = dragFrac ?? p.progress
  const seekFrom = (clientX: number) => { if (railRef.current) setDragFrac(fractionFromPointer(clientX, railRef.current.getBoundingClientRect())) }
  const dim: CSSProperties = p.ready ? {} : { opacity: 0.45, pointerEvents: 'none' }
  const radioWord = t.settingsVolRadio   // localized "Radio"
  // Transport buttons stretch to fill the full width of their row.
  const transportBtn: CSSProperties = { ...iconBtn, width: 'auto', flex: 1, height: 38 }
  const transport = (
    <div style={{ display: 'flex', gap: 8, width: '100%', ...dim }}>
      <button style={transportBtn} onClick={p.onPrev} aria-label={t.radioPrev} data-testid="radio-prev">⏮</button>
      <button style={transportBtn} onClick={p.onPlayPause} aria-label={p.playing ? t.radioPause : t.radioPlay} data-testid="radio-playpause">{p.playing ? '⏸' : '▶'}</button>
      <button style={transportBtn} onClick={p.onNext} aria-label={t.radioNext} data-testid="radio-next">⏭</button>
    </div>
  )

  return (
    <div className="radio-player-root" style={wrap(p.expanded)} data-testid="radio-player">
      {p.expanded && (() => {
        // The minimized-panel bars stack above the card; the one collapsed LAST sits on top (p.lastMin).
        const lib = p.libraryMin ? <button key="lib" style={backBtn} className="rexp-anim-in" onClick={p.onRestoreLibrary} data-testid="radio-explorer-min">{t.radioLibrary}</button> : null
        const code = p.codeMin ? <button key="code" style={backBtn} className="rexp-anim-in" onClick={p.onRestoreCode} data-testid="radio-code-min">{t.radioProgram}</button> : null
        return p.lastMin === 'code' ? [code, lib] : [lib, code]
      })()}
      {/* Drag from ANY empty area of the player to save the current track. Controls (slider/buttons) must keep their
          native behaviour: toggle the card's draggable OFF synchronously on pointerdown over a control, else the
          browser starts an HTML5 drag of the card instead of letting the range thumb move. */}
      <div ref={cardRef} style={p.expanded ? { ...card, cursor: 'grab' } : card} data-testid="radio-drag"
        draggable={p.expanded}
        onPointerDown={e => {
          const onControl = !!(e.target as HTMLElement).closest('button, input, .slider, .scrub')
          if (cardRef.current) cardRef.current.draggable = p.expanded && !onControl
        }}
        onDragStart={e => {
          if ((e.target as HTMLElement).closest('button, input, .slider, .scrub')) { e.preventDefault(); return } // let controls work
          const j = p.onDragTrack()
          if (j) { e.dataTransfer.setData(DT_TRACK, j); e.dataTransfer.effectAllowed = 'copy'; setCassetteDragImage(e.dataTransfer) }
          else e.preventDefault()
        }}>
        {/* Row 1 — track name (collapsed: click to open) */}
        <div style={title(!p.expanded)} data-testid="radio-track-name" onClick={!p.expanded ? p.onOpen : undefined}>{p.trackName || radioWord}</div>

        {p.expanded ? (
          <>
            {/* subtitle — BPM / key */}
            <div style={{ ...subRow, ...dim }}>{p.subtitle || radioWord}</div>
            {/* scrub bar — position + click/drag seek (expanded only) */}
            <div style={{ ...scrubRow, ...dim }} data-testid="radio-scrub-row">
              <span style={timeLabel}>{fmtMs(shownFrac * p.totalMs)}</span>
              <div ref={railRef} className="scrub" style={scrubHit} data-testid="radio-scrub"
                onPointerDown={e => { e.currentTarget.setPointerCapture(e.pointerId); seekFrom(e.clientX) }}
                onPointerMove={e => { if (dragFrac !== null) seekFrom(e.clientX) }}
                onPointerUp={e => { if (dragFrac !== null) { p.onSeek(dragFrac); setDragFrac(null) } e.currentTarget.releasePointerCapture(e.pointerId) }}>
                <div style={scrubRail}>
                  <div style={scrubFill(shownFrac)} data-testid="radio-scrub-fill" />
                  <div style={scrubThumb(shownFrac)} />
                </div>
              </div>
              <span style={timeLabel}>{fmtMs(p.totalMs)}</span>
            </div>
            {/* transport */}
            {transport}
            {/* Air toggle (live generative stream) + hide-ball toggle (pans the camera off the player ball) */}
            <div style={{ ...center, ...dim, gap: 8 }}>
              <button style={airBtn(p.mode === 'gen')} onClick={() => p.onMode('gen')} data-testid="radio-air">◉ {t.radioAir}</button>
              <button style={{ ...smallBtn, height: 32 }} onClick={p.onToggleBall} aria-label={p.ballHidden ? 'show ball' : 'hide ball'} data-testid="radio-ball">{p.ballHidden ? '◯' : '⬤'}</button>
            </div>
            {/* Volume (megaphone pictogram, not the word "Radio") */}
            <div style={volRow}>
              <span style={{ ...volLabel, fontSize: '0.95rem' }} aria-label="radio volume">🔊</span>
              <input className="slider" type="range" min={0} max={100} step={1}
                value={Math.round(p.volume * 100)} aria-label="radio volume"
                onChange={e => p.onVolume(Number(e.target.value) / 100)} style={{ flex: 1 }} />
            </div>
            {/* Free-trial: remaining daily quota + an "Unlock Radio" CTA (only on the trial; hidden when owned/dev). */}
            {p.trial && (
              <div style={trialRow} data-testid="radio-trial">
                <span>{t.radioFreeToday} · ⟳ {p.trial.gensLeft} · 💾 {p.trial.savesLeft}</span>
                {p.onUnlock && <button style={unlockBtn} onClick={p.onUnlock} data-testid="radio-unlock">{t.radioUnlock}</button>}
              </div>
            )}
            {p.genLimited && <div style={limitMsg} data-testid="radio-gen-limit">{t.radioGenLimit}</div>}
            {p.saveLimited && <div style={limitMsg} data-testid="radio-save-limit">{t.radioSaveLimit}</div>}
          </>
        ) : (
          // Collapsed: only the transport (prev / play-pause / next).
          transport
        )}
      </div>

      {/* BACK — a separate liquid-glass button under the player (expanded only). */}
      {p.expanded && <button style={backBtn} onClick={p.onBack} data-testid="radio-back">← {t.settingsBack}</button>}
    </div>
  )
}
