import { useRelayStatus } from '../hooks/useRelayStatus'
import { reprobe } from '../net/relays'
import type { RelayResult } from '../net/relays'

const host = (url: string) => url.replace(/^wss:\/\//, '')

/** Здоровые первыми (по возрастанию латентности), затем больные. */
function sortByHealth(results: RelayResult[]): RelayResult[] {
  return [...results].sort(
    (a, b) => Number(b.alive) - Number(a.alive) || (a.latencyMs ?? Infinity) - (b.latencyMs ?? Infinity),
  )
}

/**
 * Полный список сигналинг-релеев, отсортированный по «здоровью» (живые → мёртвые), всегда раскрыт.
 * Кнопка перепроверки форсит свежую пробу.
 */
export function RelaysSection() {
  const { phase, results, selected } = useRelayStatus()
  const probing = phase === 'probing'

  // Есть детальные результаты пробы → показываем весь пул по здоровью; иначе (кеш) — рабочий набор.
  const detailed = results.length > 0
  const rows: RelayResult[] = detailed
    ? sortByHealth(results)
    : selected.map(url => ({ url, alive: true, latencyMs: null }))

  const aliveCount = results.filter(r => r.alive).length
  const summary = probing ? 'ПРОВЕРКА…' : detailed ? `ЖИВЫХ ${aliveCount}/${results.length}` : `В РАБОТЕ ${selected.length}`

  return (
    <div className="relays">
      <div className="relays-head relays-head--static">
        <span>РЕЛЕИ</span>
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
        {probing ? 'ПРОВЕРКА…' : 'ПРОВЕРИТЬ ЗАНОВО'}
      </button>
    </div>
  )
}
