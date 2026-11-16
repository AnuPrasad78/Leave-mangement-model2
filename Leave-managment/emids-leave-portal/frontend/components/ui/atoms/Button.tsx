import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'ghost' | 'danger'
export type ButtonSize = 'sm'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  busy?: boolean
  busyLabel?: string
  children?: ReactNode
}

export function Button({ variant = 'primary', size, busy, busyLabel, className = '', disabled, children, type = 'button', ...props }: ButtonProps) {
  const classes = ['btn', `btn--${variant}`]
  if (size) classes.push(`btn--${size}`)
  if (className) classes.push(className)
  return (
    <button
      className={classes.join(' ')}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy ? 'true' : undefined}
      {...props}
    >
      {busy ? <span className='spinner' /> : null}
      {busy ? busyLabel : children}
    </button>
  )
}
