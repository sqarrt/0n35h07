const BRACKETS = [
  { key: 'tl', pos: { top: 20, left: 20 },     path: 'M 3 55 L 3 3 L 55 3'   },
  { key: 'tr', pos: { top: 20, right: 20 },    path: 'M 57 55 L 57 3 L 5 3'  },
  { key: 'bl', pos: { bottom: 20, left: 20 },  path: 'M 3 5 L 3 57 L 55 57'  },
  { key: 'br', pos: { bottom: 20, right: 20 }, path: 'M 57 5 L 57 57 L 5 57' },
] as const

interface ShieldBracketsProps {
  shieldProgress: number
  shieldVisible: boolean
  shieldBlock: boolean
}

export function ShieldBrackets({ shieldProgress, shieldVisible, shieldBlock }: ShieldBracketsProps) {
  const color   = shieldVisible ? '#6af' : (shieldProgress >= 1 ? '#4169e1' : '#1a2a6e')
  const opacity = shieldVisible ? 1 : (shieldProgress >= 1 ? 0.85 : 0.5)

  return (
    <>
      {BRACKETS.map(({ key, pos, path }) => (
        <div key={key} style={{ position: 'fixed', pointerEvents: 'none', zIndex: 11, ...pos }}>
          <svg width="60" height="60" viewBox="0 0 60 60">
            <path d={path} fill="none" stroke="#223" strokeWidth="6" opacity="0.4" />
            <path
              d={path}
              fill="none"
              stroke={shieldBlock ? '#fff' : color}
              strokeWidth="6"
              strokeDasharray="104"
              strokeDashoffset={`${104 * (1 - shieldProgress)}`}
              strokeLinecap="square"
              opacity={shieldBlock ? 1 : opacity}
              style={
                shieldBlock
                  ? { filter: 'drop-shadow(0 0 8px #fff) brightness(4)' }
                  : shieldVisible ? { filter: 'drop-shadow(0 0 6px #4169e1)' } : undefined
              }
            />
          </svg>
        </div>
      ))}
    </>
  )
}
