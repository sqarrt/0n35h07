import { useRelayStatus } from '../hooks/useRelayStatus'
import { reprobe } from '../net/relays'
import type { RelayResult } from '../net/relays'
import { useT } from '../i18n'

const host = (url: string) => url.replace(/^wss:\/\//, '')

/** Healthy first (by ascending latency), then unhealthy. */
function sortByHealth(results: RelayResult[]): RelayResult[] {
  return [...results].sort(
    (a, b) => Number(b.alive) - Number(a.alive) || (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity),
  )
}

/**
 * Full list of signaling relays, sorted by health (alive → dead), always expanded.
 * The re-probe button forces a fresh probe.
 */
export function RelaysSection() {
  const t = useT()
  const { phase, results, selected } = useRelayStatus()
  const probing = phase === 'probing'

  // Detailed probe results available → show the whole pool by health; otherwise (cache) — the working set.
  const detailed = results.length > 0
  const rows: RelayResult[] = detailed
    ? sortByHealth(results)
    : selected.map(url => ({ url, alive: true, latencyMs: null }))

  const aliveCount = results.filter(r => r.alive).length
  const summary = probing ? t.relaysProbing : detailed ? t.relaysAlive(aliveCount, results.length) : t.relaysInUse(selected.length)

  return (
    <div className="relays">
      <div className="relays-head relays-head--static">
        <span>{t.relaysTitle}</span>
        <span className="relays-sum">{summary}</span>
      </div>

      <div className="relays-list">
        {rows.map(r => (
          <div className="relay-row" key={r.url}>
            <span className={`dot ${detailed ? (r.alive ? 'dot--ok' : 'dot--dead') : 'dot--muted'}`}>
              {detailed && !r.alive ? '○' : '●'}
            </span>
            <span className="relay-host">{host(r.url)}</span>
            <span className="relay-lat">{r.latencyMs != null ? `${r.latencyMs}ms` : '—'}</span>
          </div>
        ))}
      </div>
      <button className="seg" onClick={() => void reprobe()} disabled={probing}>
        {probing ? t.relaysProbing : t.relaysReprobe}
      </button>
    </div>
  )
}
