import { useRelayStatus } from '../hooks/useRelayStatus'
import { useT } from '../i18n'

/**
 * Ненавязчивый индикатор пробы сигналинг-релеев в углу пред-игровых экранов. Тихий по умолчанию —
 * заметен только тому, кто ищет. Состояния: проверка / живых N / резерв (живых не нашли).
 */
export function NetStatusChip() {
  const t = useT()
  const { phase, results, selected } = useRelayStatus()

  if (phase === 'idle') return null

  if (phase === 'probing') {
    return (
      <div className="net-chip" data-testid="net-chip" title={t.netChipProbingTitle}>
        <span className="dot dot--probing">◇</span>
        <span>{t.netChipProbing}</span>
      </div>
    )
  }

  // Деградация: проба отработала, но живых релеев не нашлось → используем курируемый резерв.
  const fellBack = results.length > 0 && results.every(r => !r.alive)
  return (
    <div className="net-chip" data-testid="net-chip" title={t.netChipTitle}>
      <span className={`dot ${fellBack ? 'dot--warn' : 'dot--ok'}`}>●</span>
      <span>{fellBack ? t.netChipFallback : t.netChipOk(selected.length)}</span>
    </div>
  )
}
