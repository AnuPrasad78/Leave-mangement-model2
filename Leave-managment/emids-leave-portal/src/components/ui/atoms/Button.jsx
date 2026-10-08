export function Button({ variant = 'primary', size, busy, busyLabel, className = '', disabled, children, type = 'button', ...props }) {
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
