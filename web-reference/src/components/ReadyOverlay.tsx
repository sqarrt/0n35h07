import type { RosterEntry } from '../net/protocol'
import { ControlsLegend } from './ControlsLegend'
import { useSfx } from '../sfx/SfxContext'
import { useT } from '../i18n'
import type { Dict } from '../i18n/dict'

interface ReadyOverlayProps {
  roster: RosterEntry[]
  localId: number
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

/** Lightweight ready overlay above the arena. Click anywhere = ready.
 *  Two players — the classic corners; three+ — a centered participant list (functional layout). */
export function ReadyOverlay({ roster, localId, ready, onReady }: ReadyOverlayProps) {
  const sfx = useSfx()
  const t = useT()
  const sorted = [...roster].sort((a, b) => a.id - b.id)
  const iAmReady = ready.includes(localId)   // ready and waiting for the others → swap the hint
  const handleReady = () => {
    if (!iAmReady) sfx.play2D('ready')   // sound only on the transition to "ready"
    onReady()
  }
  return (
    <div className="ready-overlay" onClick={handleReady}>
      <div className="ready-tint-l" />
      <div className="ready-tint-r" />
      {sorted.length <= 2 ? (
        <>
          {corner(sorted[0], 'l', !!sorted[0] && ready.includes(sorted[0].id), sorted[0]?.id === localId, t)}
          {corner(sorted[1], 'r', !!sorted[1] && ready.includes(sorted[1].id), sorted[1]?.id === localId, t)}
        </>
      ) : (
        // Two columns anchored to the screen's center line: names end AT the line, statuses start after it.
        <div style={{ position: 'absolute', left: 0, right: 0, top: 64, display: 'grid', gridTemplateColumns: '1fr 1fr', columnGap: 12, rowGap: 6, alignItems: 'baseline' }} data-testid="ready-list">
          {sorted.map(e => (
            <div key={e.id} style={{ display: 'contents' }} data-testid={`ready-row-${e.id}`}>
              <span style={{ color: e.color, justifySelf: 'end', textDecoration: e.id === localId ? 'underline' : undefined, textUnderlineOffset: 3 }}>{e.name}</span>
              <small style={{ justifySelf: 'start', color: ready.includes(e.id) ? 'var(--ok)' : 'var(--muted)' }}>
                {ready.includes(e.id) ? t.readyStatusReady : t.readyStatusNotReady}
              </small>
            </div>
          ))}
        </div>
      )}
      <div className="ready-hint" data-testid="ready-button">
        {iAmReady ? t.readyWaiting : <><span className="hkey">{t.keyLmb}</span> {t.readyHintAction}</>}
      </div>
      <div className="ready-legend"><ControlsLegend /></div>
    </div>
  )
}
