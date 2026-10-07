export function Chip({ isOn, className = 'chip', children, ...props }) {
  return (
    <button type='button' className={`${className}${isOn ? ' is-on' : ''}`} aria-pressed={Boolean(isOn)} {...props}>
      {children}
    </button>
  )
}

export function SegmentedControl({ value, options, onChange, ariaLabel }) {
  return (
    <div className='seg' role='group' aria-label={ariaLabel}>
      {options.map((option) => (
        <button type='button' key={option} className={value === option ? 'is-on' : ''} aria-pressed={value === option} onClick={() => onChange(option)}>
          {option}
        </button>
      ))}
    </div>
  )
}
