import type { ButtonHTMLAttributes } from 'react'

type Variant = 'primary' | 'secondary' | 'ghost'

const VARIANT_CLASS: Record<Variant, string> = {
  primary: 'btn btn--primary',
  secondary: 'btn',
  ghost: 'btn btn--ghost',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
}

/** Hard-кнопка проекта. Нативный <button> (роли/disabled для e2e сохранены). */
export function Button({ variant = 'secondary', className, ...rest }: ButtonProps) {
  const cls = `${VARIANT_CLASS[variant]}${className ? ` ${className}` : ''}`
  return <button className={cls} {...rest} />
}
