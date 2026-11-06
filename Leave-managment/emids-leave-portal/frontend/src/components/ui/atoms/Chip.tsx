import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  // Undefined means "not picked" — aria-pressed collapses via Boolean(isOn).
  isOn?: boolean
  className?: string
  children?: ReactNode
}

export function Chip({ isOn, className = 'chip', children, ...props }: ChipProps) {
  return (
    <button type='button' className={`${className}${isOn ? ' is-on' : ''}`} aria-pressed={Boolean(isOn)} {...props}>
      {children}
    </button>
  )
}
