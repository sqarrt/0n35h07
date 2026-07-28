interface WindupOverlayProps {
  windupProgress: number
}

export function WindupOverlay({ windupProgress }: WindupOverlayProps) {
  if (windupProgress <= 0) return null
  // Charge glow vignette. Previously an inset box-shadow with blur, changing every frame → EXPENSIVE full-screen
  // repaint (heavier the larger the window, plus it stacked on postprocessing = FPS spike). Now the gradient is
  // static and only opacity animates — that's the compositor (GPU), no repaint. Progress is throttled (50ms),
  // and a CSS opacity transition smooths between steps — fluid and cheap.
  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,150,255,0.55) 100%)',
      opacity: windupProgress,
      transition: 'opacity 70ms linear',
      pointerEvents: 'none', zIndex: 9,
    }} />
  )
}
