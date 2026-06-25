import type { CSSProperties } from 'react'
import { glassCard } from './glass'
import { useT } from '../i18n'

export type RadioPlayMode = 'gen' | 'fav'

interface RadioPlayerProps {
  expanded: boolean       // radio screen → full size; otherwise → shrunk into the bottom-right corner (still interactive)
  ready: boolean          // radio engine initialised (controls usable)
  mode: RadioPlayMode
  playing: boolean
  trackName: string
  subtitle: string
  liked: boolean
  disliked: boolean
  volume: number          // 0..1 (profile.volumeRadio)
  onMode: (m: RadioPlayMode) => void
  onPrev: () => void
  onNext: () => void
  onPlayPause: () => void
  onLike: () => void
  onDislike: () => void
  onRegen: () => void     // regenerate the session seed (fresh generative session)
  onVolume: (v: number) => void
  onOpen: () => void      // collapsed → open the Radio screen
  onBack: () => void      // expanded → leave the Radio screen
}

const COLLAPSED_SCALE = 0.46
// "RADIO" and "BACK" are universal literals — NEVER localized (every language writes them the same).
const RADIO_LABEL = 'RADIO'
const BACK_LABEL = '← BACK'

// Anchored bottom-right; shrinks toward the corner (transform-origin) so it "docks" where the indicator sits.
const wrap = (expanded: boolean): CSSProperties => ({
  position: 'fixed', right: 18, bottom: 18, zIndex: 50,
  transformOrigin: 'bottom right',
  transform: expanded ? 'scale(1)' : `scale(${COLLAPSED_SCALE})`,
  transition: 'transform 0.32s cubic-bezier(0.2,0.8,0.2,1)',
  display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 8,
  fontFamily: 'var(--ui-font)', color: '#cdd',
})
const card: CSSProperties = {
  ...glassCard, padding: '12px 16px', width: 300,
  display: 'flex', flexDirection: 'column', gap: 9, alignItems: 'stretch',
}
// Row 1: track name (click to open when collapsed).
const titleRow = (clickable: boolean): CSSProperties => ({
  textAlign: 'center', color: '#eef', letterSpacing: '0.05em', fontSize: '0.92rem',
  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', cursor: clickable ? 'pointer' : 'default',
})
// Row 2: details.
const subRow: CSSProperties = { textAlign: 'center', color: 'var(--accent-dim)', fontSize: '0.7rem', letterSpacing: '0.12em' }
// Rows of buttons.
const spread: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center' }
const center: CSSProperties = { display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 12 }
// grid+placeItems reliably centers symbol glyphs (flex+baseline left them a touch low).
const iconBtn: CSSProperties = {
  appearance: 'none', background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10,
  width: 42, height: 36, cursor: 'pointer', color: '#cdd', font: 'inherit', fontSize: '1.05rem',
  display: 'grid', placeItems: 'center', lineHeight: 1, padding: 0,
}
const heart = (on: boolean): CSSProperties => ({ ...iconBtn, color: on ? 'var(--accent)' : '#cdd', borderColor: on ? 'var(--accent)' : 'rgba(255,255,255,0.14)' })
const smallBtn: CSSProperties = { ...iconBtn, width: 34, height: 30, fontSize: '0.9rem' }
const modeWrap: CSSProperties = { display: 'flex', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, overflow: 'hidden', flex: 1 }
const seg = (on: boolean): CSSProperties => ({
  appearance: 'none', border: 'none', background: on ? 'rgba(120,180,255,0.18)' : 'transparent', cursor: 'pointer',
  color: on ? 'var(--accent)' : '#9ab', font: 'inherit', fontSize: '0.7rem', letterSpacing: '0.1em', padding: '7px 0', flex: 1,
})
const volRow: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8 }
const volLabel: CSSProperties = { color: '#667', fontSize: '0.62rem', letterSpacing: '0.14em', flex: '0 0 auto' }
const backBtn: CSSProperties = {
  ...glassCard, appearance: 'none', cursor: 'pointer', padding: '9px 0',
  color: '#cdd', font: 'inherit', fontFamily: 'var(--ui-font)', fontSize: '0.74rem', letterSpacing: '0.16em', textAlign: 'center',
}

/** Unified radio player: expanded on the Radio screen, docked (shrunk, still interactive) in the corner elsewhere.
 *  Desktop-only (gate at the call site). RADIO/BACK are literal in every language. */
export function RadioPlayer(p: RadioPlayerProps) {
  const t = useT()
  const dim: CSSProperties = p.ready ? {} : { opacity: 0.45, pointerEvents: 'none' }
  return (
    <div style={wrap(p.expanded)} data-testid="radio-player">
      <div style={card}>
        {/* Row 1 — track name (collapsed: click to open) */}
        <div
          style={titleRow(!p.expanded)}
          title={p.trackName}
          data-testid="radio-track-name"
          onClick={!p.expanded ? p.onOpen : undefined}
        >{p.trackName || RADIO_LABEL}</div>

        {/* Row 2 — details */}
        <div style={subRow}>{p.subtitle || RADIO_LABEL}</div>

        {/* Row 3 — dislike (left) / like (right) */}
        <div style={{ ...spread, ...dim }}>
          <button style={heart(p.disliked)} onClick={p.onDislike} aria-label={t.radioDislike} data-testid="radio-dislike">💔</button>
          <button style={heart(p.liked)} onClick={p.onLike} aria-label={t.radioLike} data-testid="radio-like">♥</button>
        </div>

        {/* Row 4 — prev / play-pause / next */}
        <div style={{ ...center, ...dim }}>
          <button style={iconBtn} onClick={p.onPrev} aria-label={t.radioPrev} data-testid="radio-prev">⏮</button>
          <button style={iconBtn} onClick={p.onPlayPause} aria-label={p.playing ? t.radioPause : t.radioPlay} data-testid="radio-playpause">{p.playing ? '⏸' : '▶'}</button>
          <button style={iconBtn} onClick={p.onNext} aria-label={t.radioNext} data-testid="radio-next">⏭</button>
        </div>

        {/* Row 5 — Generation | Favorites (+ regenerate-seed) */}
        <div style={{ ...center, ...dim, gap: 8 }}>
          <div style={modeWrap}>
            <button style={seg(p.mode === 'gen')} onClick={() => p.onMode('gen')} data-testid="radio-mode-gen">{t.radioGeneration}</button>
            <button style={seg(p.mode === 'fav')} onClick={() => p.onMode('fav')} data-testid="radio-mode-fav">{t.radioFavorites}</button>
          </div>
          <button style={smallBtn} onClick={p.onRegen} aria-label="regenerate seed" data-testid="radio-regen">🎲</button>
        </div>

        {/* Volume (expanded only) */}
        {p.expanded && (
          <div style={volRow}>
            <span style={volLabel}>{RADIO_LABEL}</span>
            <input className="slider" type="range" min={0} max={100} step={1}
              value={Math.round(p.volume * 100)} aria-label="radio volume"
              onChange={e => p.onVolume(Number(e.target.value) / 100)} style={{ flex: 1 }} />
          </div>
        )}
      </div>

      {/* BACK — a separate liquid-glass button under the player (expanded only). */}
      {p.expanded && <button style={backBtn} onClick={p.onBack} data-testid="radio-back">{BACK_LABEL}</button>}
    </div>
  )
}
