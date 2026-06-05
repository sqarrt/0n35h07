interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  'aria-label'?: string
}

/** Тумблер вкл/выкл в стиле игры (плоский, твёрдый, без плавных переходов). */
export function Toggle({ checked, onChange, 'aria-label': ariaLabel }: ToggleProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      className="toggle"
      data-on={checked}
      onClick={() => onChange(!checked)}
    >
      <span className="toggle-knob" />
    </button>
  )
}
