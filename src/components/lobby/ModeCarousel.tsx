import { GAME_MODES, MODE_LABEL, type GameMode } from '../../game/modes'
import { useSfx } from '../../sfx/SfxContext'

type TileRole = 'left' | 'center' | 'right'

interface ModeCarouselProps {
  mode: GameMode
  enabled: boolean   // the host owns the preset; guests and mid-search see it locked
  onSetMode: (m: GameMode) => void
}

/** Mode preset carousel: the selected tile centered, its cyclic neighbours dimmed at the sides.
 *  All three tiles stay mounted in fixed roles (left/center/right) — switching only moves
 *  transform/opacity, so the block never changes height. */
export function ModeCarousel({ mode, enabled, onSetMode }: ModeCarouselProps) {
  const sfx = useSfx()
  const count = GAME_MODES.length
  const idx = GAME_MODES.indexOf(mode)
  const roleOf = (m: GameMode): TileRole =>
    m === mode ? 'center' : m === GAME_MODES[(idx + 1) % count] ? 'right' : 'left'
  const pick = (m: GameMode) => { if (!enabled || m === mode) return; sfx.play2D('ui_toggle'); onSetMode(m) }

  return (
    <div className={`mode-carousel${enabled ? '' : ' mode-carousel--locked'}`}>
      {GAME_MODES.map(m => {
        const role = roleOf(m)
        return (
          <button key={m} className={`mode-tile mode-tile--${role}`} data-testid={`mode-tile-${m}`} data-role={role}
            disabled={!enabled} onClick={() => pick(m)}>
            <span className="mode-tile-name">{MODE_LABEL[m]}</span>
          </button>
        )
      })}
    </div>
  )
}
