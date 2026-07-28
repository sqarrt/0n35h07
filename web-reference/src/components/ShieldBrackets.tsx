import { useEffect, useRef, useState } from 'react'

// Svg size, inset from the frame edge, arm length (≈1.5× the previous one).
const S = 90, M = 4, A = 78

// Corners: container position + vertex (vx,vy) + ends of the horizontal (hx,hy) and vertical (vX,vY) arms.
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

/** Shield corner brackets: fill from the vertex toward the ends as the cooldown elapses; brief glow when ready. */
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

  // Opacity/glow are applied to the GROUP of arms (not to each path): otherwise at the corner vertex, where
  // perpendicular arms overlap, the semi-transparencies multiply and the corner shows brighter (a "seam").
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
