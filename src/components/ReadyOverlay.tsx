import type { RosterEntry } from '../net/protocol'
import type { MatchRole } from '../constants'
import { HOST_ID, OPPONENT_ID } from '../constants'
import { ControlsLegend } from './ControlsLegend'
import { useSfx } from '../sfx/SfxContext'
import { useT } from '../i18n'
import type { Dict } from '../i18n/dict'

interface ReadyOverlayProps {
  roster: RosterEntry[]
  localId: number
  role: MatchRole
  ready: number[]
  onReady: () => void
}

function corner(entry: RosterEntry | undefined, side: 'l' | 'r', isReady: boolean, mine: boolean, t: Dict) {
  if (!entry) return null
  const pos = side === 'l' ? { left: 18 } : { right: 18, textAlign: 'right' as const }
  return (
    <div className="ready-corner" style={{ ...pos, color: entry.color }}>
      <span style={{ textDecoration: mine ? 'underline' : undefined, textUnderlineOffset: 3 }}>{entry.name}</span>
      <small style={{ color: isReady ? 'var(--ok)' : 'var(--muted)' }}>{isReady ? t.readyStatusReady : t.readyStatusNotReady}</small>
    </div>
  )
}

/** Лёгкий оверлей готовности над ареной. Клик в любом месте = готов. */
export function ReadyOverlay({ roster, localId, ready, onReady }: ReadyOverlayProps) {
  const sfx = useSfx()
  const t = useT()
  const host = roster.find(r => r.id === HOST_ID)
  const opponent = roster.find(r => r.id === OPPONENT_ID)
  const iAmReady = ready.includes(localId)   // готов и жду второго → меняем подсказку
  const handleReady = () => {
    if (!iAmReady) sfx.play2D('ready')   // звук только на переходе в «готов»
    onReady()
  }
  return (
    <div className="ready-overlay" onClick={handleReady}>
      <div className="ready-tint-l" />
      <div className="ready-tint-r" />
      {corner(host, 'l', !!host && ready.includes(host.id), host?.id === localId, t)}
      {corner(opponent, 'r', !!opponent && ready.includes(opponent.id), opponent?.id === localId, t)}
      <div className="ready-hint" data-testid="ready-button">
        {iAmReady ? t.readyWaiting : <><span className="hkey">{t.keyLmb}</span> {t.readyHintAction}</>}
      </div>
      <div className="ready-legend"><ControlsLegend /></div>
    </div>
  )
}
