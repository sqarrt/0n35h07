import type { ButtonHTMLAttributes } from 'react'
import { useSfx } from '../sfx/SfxContext'

type Variant = 'primary' | 'secondary' | 'ghost'

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn btn--primary',
  secondary: 'btn',
  ghost: 'btn btn--ghost',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

/** Hard-кнопка проекта. Нативный <button> (роли/disabled для e2e сохранены) + UI-звуки. */
export function Button({ variant = 'secondary', className, onClick, onMouseEnter, ...rest }: ButtonProps) {
  const sfx = useSfx()
  const cls = `${VARIANT_CLASS[variant]}${className ? ` ${className}` : ''}`
  return (
    <button
      className={cls}
      onClick={e => { if (!e.currentTarget.disabled) sfx.play2D('ui_click'); onClick?.(e) }}
      onMouseEnter={e => { if (!e.currentTarget.disabled) sfx.play2D('ui_hover'); onMouseEnter?.(e) }}
      {...rest}
    />
  )
}
