import type { CSSProperties } from 'react'
import { glassCard } from './glass'
import { useT } from '../i18n'
import { radioTrackName, trackSeedOf } from '../radio/trackName'
import { sameTrack } from '../radio/trackDescriptor'
import type { TrackDescriptor } from '../radio/trackDescriptor'

const nameOf = (d: TrackDescriptor) => radioTrackName({ mood: d.mood, bpm: d.bpm, trackSeed: trackSeedOf(d) })

interface FavoritesColumnProps {
  open: boolean
  items: TrackDescriptor[]
  current: TrackDescriptor | null   // the track playing now (highlighted if it's in the list)
  onPlayFirst: () => void
  onPlay: (d: TrackDescriptor) => void
}

const COLUMN_W = 320

// Right, full-height, slides in via transform (no sibling reflow → no layout jump).
const wrap = (open: boolean): CSSProperties => ({
  position: 'fixed', top: 0, right: 0, bottom: 0, width: COLUMN_W, zIndex: 49,
  transform: open ? 'translateX(0)' : `translateX(${COLUMN_W + 24}px)`,
  transition: 'transform 0.28s cubic-bezier(0.2,0.8,0.2,1)',
  ...glassCard, borderRadius: 0,
  display: 'flex', flexDirection: 'column',
  fontFamily: 'var(--ui-font)', color: '#cdd',
})
const header: CSSProperties = { padding: '20px 18px 12px', color: 'var(--accent)', letterSpacing: '0.22em', fontSize: '0.8rem' }
const playBtn: CSSProperties = {
  appearance: 'none', margin: '0 18px 12px', padding: '9px 0', cursor: 'pointer',
  background: 'rgba(120,180,255,0.16)', border: '1px solid var(--accent)', borderRadius: 10,
  color: 'var(--accent)', font: 'inherit', fontSize: '0.78rem', letterSpacing: '0.14em',
}
const list: CSSProperties = { overflowY: 'auto', flex: 1, padding: '0 10px 16px' }
const row = (on: boolean): CSSProperties => ({
  appearance: 'none', width: '100%', textAlign: 'left', cursor: 'pointer',
  background: on ? 'rgba(120,180,255,0.14)' : 'transparent', border: 'none',
  borderLeft: on ? '2px solid var(--accent)' : '2px solid transparent',
  color: on ? 'var(--accent)' : '#cdd', font: 'inherit', padding: '9px 10px',
  display: 'flex', flexDirection: 'column', gap: 2,
})
const rowName: CSSProperties = { fontSize: '0.8rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
const rowSub: CSSProperties = { fontSize: '0.68rem', color: 'var(--accent-dim)', letterSpacing: '0.1em' }
const empty: CSSProperties = { padding: '8px 18px', color: 'var(--accent-dim)', fontSize: '0.78rem' }

/** Right slide-in list of saved tracks (DOM glass). Desktop-only (gate at the call site). */
export function FavoritesColumn({ open, items, current, onPlayFirst, onPlay }: FavoritesColumnProps) {
  const t = useT()
  return (
    <div style={wrap(open)} data-testid="radio-favorites" aria-hidden={!open}>
      <div style={header}>{t.radioFavorites}</div>
      <button style={playBtn} onClick={onPlayFirst} disabled={items.length === 0} data-testid="radio-fav-play">▶ {t.radioPlay}</button>
      <div style={list}>
        {items.length === 0 && <div style={empty}>—</div>}
        {items.map(d => {
          const on = current != null && sameTrack(current, d)
          return (
            <button key={`${d.seed}:${d.index}`} style={row(on)} onClick={() => onPlay(d)} data-testid="radio-fav-row">
              <span style={rowName} title={nameOf(d)}>{nameOf(d)}</span>
              <span style={rowSub}>{d.mood} · {d.bpm} BPM</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
