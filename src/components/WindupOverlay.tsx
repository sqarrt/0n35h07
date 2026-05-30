interface WindupOverlayProps {
  windupProgress: number
}

export function WindupOverlay({ windupProgress }: WindupOverlayProps) {
  if (windupProgress <= 0) return null
  return (
    <div style={{
      position: 'fixed', inset: 0,
      boxShadow: `inset 0 0 ${110 * windupProgress}px rgba(0,150,255,0.55)`,
      pointerEvents: 'none', zIndex: 9,
    }} />
  )
}
