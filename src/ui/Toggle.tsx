import { useSfx } from '../sfx/SfxContext'

interface ToggleProps {
  checked: boolean
  onChange: (v: boolean) => void
  'aria-label'?: string
  'data-testid'?: string
}

/** Тумблер вкл/выкл в стиле игры (плоский, твёрдый, без плавных переходов). */
export function Toggle({ checked, onChange, 'aria-label': ariaLabel, 'data-testid': testId }: ToggleProps) {
  const sfx = useSfx()
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={ariaLabel}
      data-testid={testId}
      className="toggle"
      data-on={checked}
      onClick={() => { sfx.play2D('ui_toggle'); onChange(!checked) }}
    >
      <span className="toggle-knob" />
    </button>
  )
}
