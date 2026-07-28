import { useRelayStatus } from '../hooks/useRelayStatus'
import { useT } from '../i18n'

/**
 * Unobtrusive signaling-relay probe indicator in the corner of pre-game screens. Quiet by default —
 * noticeable only to those looking for it. States: probing / N alive / fallback (none alive).
 */
export function NetStatusChip() {
  const t = useT()
  const { phase, results, selected } = useRelayStatus()

  if (phase === 'idle') return null

  if (phase === 'probing') {
    return (
      <div className="net-chip" data-testid="net-chip">
        <span className="dot dot--probing">◇</span>
        <span>{t.netChipProbing}</span>
      </div>
    )
  }

  // Degraded: the probe ran but no live relays were found → use the curated fallback.
  const fellBack = results.length > 0 && results.every(r => !r.alive)
  return (
    <div className="net-chip" data-testid="net-chip">
      <span className={`dot ${fellBack ? 'dot--warn' : 'dot--ok'}`}>●</span>
      <span>{fellBack ? t.netChipFallback : t.netChipOk(selected.length)}</span>
    </div>
  )
}
