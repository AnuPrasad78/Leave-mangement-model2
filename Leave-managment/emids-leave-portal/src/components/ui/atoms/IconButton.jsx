export function IconButton({ label, isOn, className, type = 'button', children, ...props }) {
  return (
    <button
      type={type}
      className={[
        'icon-btn',
        className,
        typeof isOn === 'boolean' && isOn ? 'is-on' : undefined,
      ].filter(Boolean).join(' ')}
      aria-label={label}
      title={props.title ?? label}
      aria-pressed={typeof isOn === 'boolean' ? isOn : undefined}
      {...props}
    >
      {children}
    </button>
  )
}
