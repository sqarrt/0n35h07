import { useT } from '../i18n'

/** Central 3-2-1 countdown before the fight (camera can turn, actions frozen). */
export function CountdownOverlay({ n }: { n: number }) {
  const t = useT()
  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 12, pointerEvents: 'none',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'rgba(10,10,15,0.35)',
    }}>
      <div key={n} style={{
        fontFamily: 'var(--ui-font)', fontWeight: 'bold',
        fontSize: n > 0 ? '9rem' : '4rem', color: '#4af',
        textShadow: '0 0 40px rgba(68,170,255,0.6)',
        animation: 'cdPop 1s ease-out',
      }}>
        {n > 0 ? n : t.countdownGo}
      </div>
      <style>{'@keyframes cdPop{0%{transform:scale(1.6);opacity:0}25%{opacity:1}100%{transform:scale(1);opacity:0.9}}'}</style>
    </div>
  )
}
