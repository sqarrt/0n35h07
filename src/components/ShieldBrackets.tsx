import { useEffect, useRef, useState } from 'react'

// Размер svg, отступ от края рамки, длина плеча (≈1.5× прежней).
const S = 90, M = 4, A = 78

// Углы: позиция контейнера + вершина (vx,vy) + концы горизонт. (hx,hy) и вертик. (vX,vY) плеч.
const CORNERS = [
  { key: 'tl', pos: { top: 20, left: 20 },     vx: M,   vy: M,   hx: M + A, hy: M,     vX: M,     vY: M + A },
  { key: 'tr', pos: { top: 20, right: 20 },    vx: S-M, vy: M,   hx: S-M-A, hy: M,     vX: S-M,   vY: M + A },
  { key: 'bl', pos: { bottom: 20, left: 20 },  vx: M,   vy: S-M, hx: M + A, hy: S-M,   vX: M,     vY: S-M-A },
  { key: 'br', pos: { bottom: 20, right: 20 }, vx: S-M, vy: S-M, hx: S-M-A, hy: S-M,   vX: S-M,   vY: S-M-A },
] as const

const FLASH = '@keyframes shieldReadyFlash {' +
  '0% { filter: drop-shadow(0 0 0 rgba(65,105,225,0)) }' +
  '35% { filter: drop-shadow(0 0 10px rgba(65,105,225,0.9)) }' +
  '100% { filter: drop-shadow(0 0 0 rgba(65,105,225,0)) } }'

interface ShieldBracketsProps {
  shieldProgress: number
  shieldVisible: boolean
  shieldBlock: boolean
}

/** Угловые рамки щита: заполняются от угла-вершины к концам по мере отката; краткий glow при готовности. */
export function ShieldBrackets({ shieldProgress, shieldVisible, shieldBlock }: ShieldBracketsProps) {
  const [flash, setFlash] = useState(false)
  const prevReady = useRef(true)

  useEffect(() => {
    const ready = shieldProgress >= 1
    if (ready && !prevReady.current) {
      setFlash(true)
      const t = setTimeout(() => setFlash(false), 600)
      prevReady.current = true
      return () => clearTimeout(t)
    }
    if (!ready) prevReady.current = false
  }, [shieldProgress])

  const color   = shieldVisible ? '#6af' : (shieldProgress >= 1 ? '#4169e1' : '#1a2a6e')
  const opacity = shieldVisible ? 1 : (shieldProgress >= 1 ? 0.85 : 0.5)
  const off = A * (1 - shieldProgress)

  // Прозрачность/свечение применяются на ГРУППЕ плеч (а не на каждом path): иначе в вершине угла, где
  // перпендикулярные плечи перекрываются, полупрозрачности перемножаются и угол виден ярче («шов»).
  const armOpacity = shieldBlock ? 1 : opacity
  const armStyle = shieldBlock
    ? { filter: 'drop-shadow(0 0 8px #fff) brightness(4)' }
    : shieldVisible ? { filter: 'drop-shadow(0 0 6px #4169e1)' }
    : flash ? { animation: 'shieldReadyFlash 0.6s ease-out' }
    : undefined

  return (
    <>
      <style>{FLASH}</style>
      {CORNERS.map(c => {
        const hPath = `M ${c.vx} ${c.vy} L ${c.hx} ${c.hy}`
        const vPath = `M ${c.vx} ${c.vy} L ${c.vX} ${c.vY}`
        const arm = (d: string) => (
          <path d={d} fill="none"
            stroke={shieldBlock ? '#fff' : color} strokeWidth="6"
            strokeDasharray={`${A}`} strokeDashoffset={`${off}`} strokeLinecap="square" />
        )
        return (
          <div key={c.key} style={{ position: 'fixed', pointerEvents: 'none', zIndex: 11, ...c.pos }}>
            <svg width={S} height={S} viewBox={`0 0 ${S} ${S}`}>
              <g opacity="0.4">
                <path d={hPath} fill="none" stroke="#223" strokeWidth="6" />
                <path d={vPath} fill="none" stroke="#223" strokeWidth="6" />
              </g>
              <g opacity={armOpacity} style={armStyle}>
                {arm(hPath)}
                {arm(vPath)}
              </g>
            </svg>
          </div>
        )
      })}
    </>
  )
}
