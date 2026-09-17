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

/** The game's hard button (web ui/Button) without its UI sounds — this dev tool ships no audio. */
export function Button({ variant = 'secondary', className, ...rest }: ButtonProps) {
  return <button className={`${VARIANT_CLASS[variant]}${className ? ` ${className}` : ''}`} {...rest} />
}
