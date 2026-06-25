import type { CSSProperties } from 'react'
import { glassCard } from './glass'
import { useT } from '../i18n'

export type RadioPlayMode = 'gen' | 'fav'

interface RadioPlayerBarProps {
  mode: RadioPlayMode
  playing: boolean        // radio is on (profile.radioEnabled)
  trackName: string
  subtitle: string        // e.g. "124 BPM · E phrygian"
  liked: boolean
  disliked: boolean
  onPrev: () => void
  onNext: () => void
  onPlayPause: () => void
  onLike: () => void
  onDislike: () => void
  onMode: (m: RadioPlayMode) => void
}

// Bottom-centered liquid-glass transport bar. All controls are fixed-size so states never shift layout.
const bar: CSSProperties = {
  position: 'fixed', left: '50%', bottom: 22, transform: 'translateX(-50%)', zIndex: 50,
  ...glassCard, padding: '12px 18px',
  display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
  fontFamily: 'var(--ui-font)', color: '#cdd', minWidth: 360, maxWidth: 560,
}
const titleRow: CSSProperties = { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2, maxWidth: 520 }
const title: CSSProperties = { color: '#eef', letterSpacing: '0.06em', fontSize: '0.95rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: 520 }
const sub: CSSProperties = { color: 'var(--accent-dim)', fontSize: '0.72rem', letterSpacing: '0.12em' }
const controls: CSSProperties = { display: 'flex', alignItems: 'center', gap: 12 }
const iconBtn: CSSProperties = {
  appearance: 'none', background: 'transparent', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10,
  width: 40, height: 36, cursor: 'pointer', color: '#cdd', font: 'inherit', fontSize: '1rem',
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flex: '0 0 auto',
}
const heart = (on: boolean): CSSProperties => ({ ...iconBtn, color: on ? 'var(--accent)' : '#cdd', borderColor: on ? 'var(--accent)' : 'rgba(255,255,255,0.14)' })
const modeWrap: CSSProperties = { display: 'flex', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 10, overflow: 'hidden' }
const seg = (on: boolean): CSSProperties => ({
  appearance: 'none', border: 'none', background: on ? 'rgba(120,180,255,0.18)' : 'transparent', cursor: 'pointer',
  color: on ? 'var(--accent)' : '#9ab', font: 'inherit', fontSize: '0.72rem', letterSpacing: '0.12em', padding: '7px 12px',
})

/** Liquid-glass transport + like/dislike + mode toggle. Desktop-only (gate at the call site). */
export function RadioPlayerBar(p: RadioPlayerBarProps) {
  const t = useT()
  return (
    <div style={bar} data-testid="radio-player-bar">
      <div style={titleRow}>
        <div style={title} data-testid="radio-track-name" title={p.trackName}>{p.trackName}</div>
        <div style={sub}>{p.subtitle}</div>
      </div>
      <div style={controls}>
        <div style={modeWrap}>
          <button style={seg(p.mode === 'gen')} onClick={() => p.onMode('gen')} data-testid="radio-mode-gen">{t.radioGeneration}</button>
          <button style={seg(p.mode === 'fav')} onClick={() => p.onMode('fav')} data-testid="radio-mode-fav">{t.radioFavorites}</button>
        </div>
        <button style={iconBtn} onClick={p.onPrev} aria-label={t.radioPrev} data-testid="radio-prev">⏮</button>
        <button style={iconBtn} onClick={p.onPlayPause} aria-label={p.playing ? t.radioPause : t.radioPlay} data-testid="radio-playpause">{p.playing ? '⏸' : '▶'}</button>
        <button style={iconBtn} onClick={p.onNext} aria-label={t.radioNext} data-testid="radio-next">⏭</button>
        <button style={heart(p.liked)} onClick={p.onLike} aria-label={t.radioLike} data-testid="radio-like">♥</button>
        <button style={heart(p.disliked)} onClick={p.onDislike} aria-label={t.radioDislike} data-testid="radio-dislike">💔</button>
      </div>
    </div>
  )
}
