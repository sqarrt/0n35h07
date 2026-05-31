/**
 * Индикатор рывка — вертикальные полосы по бокам, ПРОДОЛЖАЮЩИЕ угловые L-рамки щита
 * (выровнены по тем же 20px от края, между верхними и нижними скобками). Заполняются
 * от центра к краям по мере отката кулдауна (тускло-зелёные во время заряда). Когда дэш
 * готов — заполнены и едва заметно пульсируют.
 */
const PULSE = '@keyframes dashPulse { 0%,100% { opacity: 0.78 } 50% { opacity: 1 } }'

function Strip({ side, pct, ready }: { side: 'left' | 'right'; pct: number; ready: boolean }) {
  return (
    <div style={{
      position: 'fixed', top: 80, bottom: 80, width: 6,
      left:  side === 'left'  ? 20 : undefined,
      right: side === 'right' ? 20 : undefined,
      background: 'rgba(255,255,255,0.05)',
      display: 'flex', flexDirection: 'column', justifyContent: 'center',
      pointerEvents: 'none', zIndex: 11,
    }}>
      <div style={{
        width: '100%', height: `${pct}%`,
        background: ready ? '#33dd66' : '#0c4d28',
        opacity: ready ? undefined : 0.55,
        boxShadow: ready ? '0 0 6px #33dd66' : 'none',
        animation: ready ? 'dashPulse 1.5s ease-in-out infinite' : 'none',
        transition: 'height 0.05s linear',
      }} />
    </div>
  )
}

export function DashIndicator({ dashProgress }: { dashProgress: number }) {
  const ready = dashProgress >= 1
  const pct = Math.min(1, Math.max(0, dashProgress)) * 100
  return (
    <>
      <style>{PULSE}</style>
      <Strip side="left"  pct={pct} ready={ready} />
      <Strip side="right" pct={pct} ready={ready} />
    </>
  )
}
