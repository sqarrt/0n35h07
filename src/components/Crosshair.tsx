const TAU = 2 * Math.PI

interface CrosshairProps {
  beamProgress: number
}

export function Crosshair({ beamProgress }: CrosshairProps) {
  return (
    <div style={{
      position: 'fixed', top: '50%', left: '50%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none', zIndex: 10,
    }}>
      <svg width="40" height="40" viewBox="0 0 40 40">
        <circle cx="20" cy="20" r="14" fill="none" stroke="#333" strokeWidth="2" opacity="0.6" />
        <circle
          cx="20" cy="20" r="14"
          fill="none"
          stroke={beamProgress >= 1 ? '#0ff' : '#066'}
          strokeWidth="2"
          strokeDasharray={`${TAU * 14}`}
          strokeDashoffset={`${TAU * 14 * (1 - beamProgress)}`}
          strokeLinecap="round"
          transform="rotate(-90 20 20)"
        />
        <text x="20" y="25" textAnchor="middle"
          fill="white" fontSize="16" fontFamily="monospace"
          style={{ filter: 'drop-shadow(0 0 2px black)', userSelect: 'none' }}>+</text>
      </svg>
    </div>
  )
}
