import type { CSSProperties } from 'react'
import { RadioPlayerBar } from '../components/RadioPlayerBar'
import type { RadioPlayMode } from '../components/RadioPlayerBar'
import { FavoritesColumn } from '../components/FavoritesColumn'
import type { TrackDescriptor } from '../radio/trackDescriptor'

// The Radio screen is a full-screen "takeover": the 3D MenuBackdrop (driven by App via radioMode) IS the
// visual; this component only lays the liquid-glass player bar (bottom) and favorites column (right) over it.

interface RadioProps {
  mode: RadioPlayMode
  playing: boolean
  current: TrackDescriptor | null
  trackName: string
  subtitle: string
  liked: boolean
  disliked: boolean
  favorites: TrackDescriptor[]
  onMode: (m: RadioPlayMode) => void
  onPrev: () => void
  onNext: () => void
  onPlayPause: () => void
  onLike: () => void
  onDislike: () => void
  onPlayFirst: () => void
  onPlayFav: (d: TrackDescriptor) => void
  onBack: () => void
}

const back: CSSProperties = {
  position: 'fixed', top: 18, left: 18, zIndex: 50,
  appearance: 'none', background: 'rgba(10,15,20,0.45)', backdropFilter: 'blur(16px)',
  border: '1px solid rgba(255,255,255,0.12)', borderRadius: 10, cursor: 'pointer',
  color: '#cdd', font: 'inherit', fontFamily: 'var(--ui-font)', fontSize: '0.78rem',
  letterSpacing: '0.14em', padding: '8px 14px',
}

export function Radio(p: RadioProps) {
  return (
    <>
      <button style={back} onClick={p.onBack} data-testid="radio-back">← BACK</button>
      <FavoritesColumn
        open={p.mode === 'fav'}
        items={p.favorites}
        current={p.current}
        onPlayFirst={p.onPlayFirst}
        onPlay={p.onPlayFav}
      />
      <RadioPlayerBar
        mode={p.mode}
        playing={p.playing}
        trackName={p.trackName}
        subtitle={p.subtitle}
        liked={p.liked}
        disliked={p.disliked}
        onPrev={p.onPrev}
        onNext={p.onNext}
        onPlayPause={p.onPlayPause}
        onLike={p.onLike}
        onDislike={p.onDislike}
        onMode={p.onMode}
      />
    </>
  )
}
