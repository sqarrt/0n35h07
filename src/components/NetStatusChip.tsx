import { useRelayStatus } from '../hooks/useRelayStatus'

/**
 * Ненавязчивый индикатор пробы сигналинг-релеев в углу пред-игровых экранов. Тихий по умолчанию —
 * заметен только тому, кто ищет. Состояния: проверка / живых N / резерв (живых не нашли).
 */
export function NetStatusChip() {
  const { phase, results, selected } = useRelayStatus()

  if (phase === 'idle') return null

  if (phase === 'probing') {
    return (
      <div className="net-chip" title="Проверка сигналинг-релеев">
        <span className="dot dot--probing">◇</span>
        <span>ПРОВЕРКА СЕТИ</span>
      </div>
    )
  }

  // Деградация: проба отработала, но живых релеев не нашлось → используем курируемый резерв.
  const fellBack = results.length > 0 && results.every(r => !r.alive)
  return (
    <div className="net-chip" title="Сигналинг-релеи">
      <span className={`dot ${fellBack ? 'dot--warn' : 'dot--ok'}`}>●</span>
      <span>{fellBack ? 'СЕТЬ · РЕЗЕРВ' : `СЕТЬ · ${selected.length}`}</span>
    </div>
  )
}
