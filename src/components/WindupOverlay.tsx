interface WindupOverlayProps {
  windupProgress: number
}

export function WindupOverlay({ windupProgress }: WindupOverlayProps) {
  if (windupProgress <= 0) return null
  // Виньетка-свечение заряда. Раньше — inset box-shadow с blur, меняющийся каждый кадр → ДОРОГОЙ full-screen
  // repaint (тем тяжелее, чем больше окно, + накладывался на постпроцесс = спайк FPS). Теперь градиент
  // статичен, а анимируется только opacity — это композитор (GPU), без repaint. Прогресс троттлится (50мс),
  // CSS-transition по opacity сглаживает между ступеньками — плавно и дёшево.
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
