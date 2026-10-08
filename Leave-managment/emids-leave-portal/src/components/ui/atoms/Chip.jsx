export function Chip({ isOn, className = 'chip', children, ...props }) {
  return (
    <button type='button' className={`${className}${isOn ? ' is-on' : ''}`} aria-pressed={Boolean(isOn)} {...props}>
      {children}
    </button>
  )
}
