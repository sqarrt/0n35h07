import type { CSSProperties } from 'react'
import type { RosterEntry } from '../net/protocol'
import type { MatchRole } from '../constants'
import { HOST_ID, OPPONENT_ID } from '../constants'
import { btn } from '../screens/styles'
import { ControlsLegend } from './ControlsLegend'

interface ReadyOverlayProps {
  roster: RosterEntry[]
  localId: number
  role: MatchRole
  ready: number[]
  onReady: () => void
}

interface HalfProps { entry?: RosterEntry; mine: boolean; isReady: boolean; onReady: () => void }

function Half({ entry, mine, isReady, onReady }: HalfProps) {
  const tint: CSSProperties = {
    position: 'absolute', inset: 0,
    background: entry?.color ?? '#223',
    opacity: isReady ? 0.22 : 0.1,
  }
  return (
    <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={tint} />
      <div style={{ position: 'relative', textAlign: 'center', fontFamily: 'monospace', color: '#ccd' }}>
        {entry ? (
          <>
            <div style={{ fontSize: '1.4rem', marginBottom: '1.2rem', color: entry.color, letterSpacing: '0.1em' }}>
              {entry.name}{mine ? ' (вы)' : ''}
            </div>
            {isReady
              ? <div style={{ letterSpacing: '0.2em', color: '#4fa' }}>ГОТОВ ✓{mine ? ' · ждём соперника' : ''}</div>
              : mine
                ? <button style={btn} onClick={onReady}>ГОТОВ</button>
                : <div style={{ color: '#667', letterSpacing: '0.2em' }}>ожидание…</div>}
          </>
        ) : (
          <div style={{ color: '#445', letterSpacing: '0.2em' }}>—</div>
        )}
      </div>
    </div>
  )
}

/** Разделённый экран готовности: слева хост, справа соперник (бот/клиент), каждый в своём цвете. */
export function ReadyOverlay({ roster, localId, role, ready, onReady }: ReadyOverlayProps) {
  const host = roster.find(r => r.id === HOST_ID)
  const opponent = roster.find(r => r.id === OPPONENT_ID)
  const mySide: 'left' | 'right' = role === 'host' ? 'left' : 'right'

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 12, display: 'flex' }}>
      <Half entry={host}     mine={mySide === 'left'  && host?.id === localId}     isReady={!!host     && ready.includes(host.id)}     onReady={onReady} />
      <div style={{ width: 1, background: '#1a2030' }} />
      <Half entry={opponent} mine={mySide === 'right' && opponent?.id === localId} isReady={!!opponent && ready.includes(opponent.id)} onReady={onReady} />

      {/* Управление — внизу по центру: читаешь, потом жмёшь ГОТОВ (центральные кнопки не перекрыты). */}
      <div style={{
        position: 'absolute', bottom: 24, left: '50%', transform: 'translateX(-50%)',
        background: 'rgba(10,10,15,0.72)', borderTop: '1px solid #1a2030', borderRadius: 8,
        padding: '0.7rem 1.2rem', pointerEvents: 'none', zIndex: 13, maxWidth: '92vw',
      }}>
        <ControlsLegend />
      </div>
    </div>
  )
}
