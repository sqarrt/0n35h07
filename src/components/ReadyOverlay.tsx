import type { RosterEntry } from '../net/protocol'
import type { MatchRole } from '../constants'
import { HOST_ID, OPPONENT_ID } from '../constants'
import { ControlsLegend } from './ControlsLegend'

interface ReadyOverlayProps {
  roster: RosterEntry[]
  localId: number
  role: MatchRole
  ready: number[]
  onReady: () => void
}

function corner(entry: RosterEntry | undefined, side: 'l' | 'r', isReady: boolean, mine: boolean) {
  if (!entry) return null
  const pos = side === 'l' ? { left: 18 } : { right: 18, textAlign: 'right' as const }
  return (
    <div className="ready-corner" style={{ ...pos, color: entry.color }}>
      {entry.name}{mine ? ' (вы)' : ''}
      <small style={{ color: isReady ? 'var(--ok)' : 'var(--muted)' }}>{isReady ? 'ГОТОВ ✓' : '○ НЕ ГОТОВ'}</small>
    </div>
  )
}

/** Лёгкий оверлей готовности над ареной. Клик в любом месте = готов. */
export function ReadyOverlay({ roster, localId, ready, onReady }: ReadyOverlayProps) {
  const host = roster.find(r => r.id === HOST_ID)
  const opponent = roster.find(r => r.id === OPPONENT_ID)
  return (
    <div className="ready-overlay" onClick={onReady}>
      <div className="ready-tint-l" />
      <div className="ready-tint-r" />
      {corner(host, 'l', !!host && ready.includes(host.id), host?.id === localId)}
      {corner(opponent, 'r', !!opponent && ready.includes(opponent.id), opponent?.id === localId)}
      <div className="ready-hint"><span className="hkey">ЛКМ</span> чтобы начать</div>
      <div className="ready-legend"><ControlsLegend /></div>
    </div>
  )
}
