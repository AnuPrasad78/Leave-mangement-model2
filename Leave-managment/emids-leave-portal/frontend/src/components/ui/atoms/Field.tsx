import { Children, isValidElement, cloneElement, type ReactNode } from 'react'

export interface FieldProps {
  label: ReactNode
  required?: boolean
  error?: string | null
  as?: 'label' | 'div'
  htmlFor?: string
  children: ReactNode
}

export function Field({ label, required, error, as = 'label', htmlFor, children }: FieldProps) {
  const Tag = as
  const errorId = htmlFor ? `${htmlFor}-error` : undefined
  const onlyChild = Children.count(children) === 1 && isValidElement<{ id?: string }>(children) ? children : null
  // cloneElement's Partial<P> can't express the aria-* pass-through keys; the
  // runtime merge keeps every original prop (including id) untouched.
  const decorated = error && onlyChild && onlyChild.props?.id ? cloneElement(onlyChild, { 'aria-invalid': 'true', 'aria-describedby': errorId } as { id?: string }) : onlyChild
  return (
    <Tag className='field' htmlFor={as === 'label' ? htmlFor : undefined}>
      <span className='field__label'>
        {label} {required ? <span className='req'>*</span> : null}
      </span>
      {decorated ?? children}
      {error ? <span id={errorId} className='muted mono'>{error}</span> : null}
    </Tag>
  )
}
