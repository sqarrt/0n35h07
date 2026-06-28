import type { CSSProperties } from 'react'
import { glassCard } from './glass'
import { DT_TRACK } from './RadioExplorer'
import './RadioExplorer.css' // the .rexp-cass cassette icon (reused as the drag image)
import { useT } from '../i18n'

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
  onDragTrack: () => string | null   // bake the current track to a library payload (drag-to-save)
  onRegen: () => void
  libraryMin?: boolean               // the explorer is minimized → show a "LIBRARY" bar above the card (same as BACK)
  onRestoreLibrary?: () => void
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
// Grip handle — press & drag to save the current track into the explorer (or the trash).
const grip: CSSProperties = { alignSelf: 'center', display: 'flex', flexDirection: 'column', gap: 2, padding: '2px 14px 0', cursor: 'grab' }
const gripRow: CSSProperties = { display: 'flex', gap: 4 }
const gripDot: CSSProperties = { width: 3, height: 3, borderRadius: '50%', background: 'var(--accent-dim)', boxShadow: '0 0 5px rgba(68,170,255,.5)' }
const volRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const volLabel: CSSProperties = { color: '#667', fontSize: '0.62rem', letterSpacing: '0.14em', flex: '0 0 auto' }
const backBtn: CSSProperties = {
  ...glassCard, appearance: 'none', cursor: 'pointer', padding: '9px 0',
  color: '#cdd', font: 'inherit', fontFamily: 'var(--ui-font)', fontSize: '0.74rem', letterSpacing: '0.16em', textAlign: 'center',
}

/** Unified radio player. Expanded (centered-bottom) on the Radio screen; docked (shrunk, still interactive) in the
 *  bottom-right corner — collapsed shows only the track name + transport. Desktop-only (gate at the call site). */
export function RadioPlayer(p: RadioPlayerProps) {
  const t = useT()
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
      {p.expanded && p.libraryMin && (
        <button style={backBtn} className="rexp-anim-in" onClick={p.onRestoreLibrary} data-testid="radio-explorer-min">{t.radioLibrary}</button>
      )}
      <div style={card}>
        {/* Row 1 — track name (collapsed: click to open) */}
        <div style={title(!p.expanded)} title={p.trackName} data-testid="radio-track-name" onClick={!p.expanded ? p.onOpen : undefined}>{p.trackName || radioWord}</div>

        {p.expanded ? (
          <>
            {/* grip — press & drag to save the current track to a folder / the trash */}
            <div style={grip} draggable
              onDragStart={e => { const j = p.onDragTrack(); if (j) { e.dataTransfer.setData(DT_TRACK, j); e.dataTransfer.effectAllowed = 'copy'; setCassetteDragImage(e.dataTransfer) } else e.preventDefault() }}
              data-testid="radio-drag">
              <div style={gripRow}><span style={gripDot} /><span style={gripDot} /><span style={gripDot} /><span style={gripDot} /></div>
              <div style={gripRow}><span style={gripDot} /><span style={gripDot} /><span style={gripDot} /><span style={gripDot} /></div>
            </div>
            {/* subtitle — BPM / key */}
            <div style={{ ...subRow, ...dim }}>{p.subtitle || radioWord}</div>
            {/* transport */}
            {transport}
            {/* Air toggle (live generative stream) + new-seed die */}
            <div style={{ ...center, ...dim, gap: 8 }}>
              <button style={airBtn(p.mode === 'gen')} onClick={() => p.onMode('gen')} data-testid="radio-air">◉ {t.radioAir}</button>
              <button style={smallBtn} onClick={p.onRegen} aria-label="regenerate seed" data-testid="radio-regen">🎲</button>
            </div>
            {/* Volume (megaphone pictogram, not the word "Radio") */}
            <div style={volRow}>
              <span style={{ ...volLabel, fontSize: '0.95rem' }} aria-label="radio volume">🔊</span>
              <input className="slider" type="range" min={0} max={100} step={1}
                value={Math.round(p.volume * 100)} aria-label="radio volume"
                onChange={e => p.onVolume(Number(e.target.value) / 100)} style={{ flex: 1 }} />
            </div>
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
