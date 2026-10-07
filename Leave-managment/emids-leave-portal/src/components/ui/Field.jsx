import { Children, isValidElement, cloneElement } from 'react'

export function Field({ label, required, error, as = 'label', htmlFor, children }) {
  const Tag = as
  const errorId = htmlFor ? `${htmlFor}-error` : undefined
  const onlyChild = Children.count(children) === 1 && isValidElement(children) ? children : null
  const decorated = error && onlyChild && onlyChild.props?.id ? cloneElement(onlyChild, { 'aria-invalid': 'true', 'aria-describedby': errorId }) : onlyChild
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
