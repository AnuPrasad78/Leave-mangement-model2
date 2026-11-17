export interface SegmentedControlProps<T extends string> {
  value: T
  options: T[]
  onChange: (option: T) => void
  ariaLabel: string
}

export function SegmentedControl<T extends string>({ value, options, onChange, ariaLabel }: SegmentedControlProps<T>) {
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
