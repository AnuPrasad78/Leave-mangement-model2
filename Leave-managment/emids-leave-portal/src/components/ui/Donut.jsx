export function Donut({ used, total, size = 190, label }) {
  const r = size * 0.39
  const cx = size / 2
  const cy = size / 2
  const circ = 2 * Math.PI * r
  const frac = total > 0 ? used / total : 0
  const usedLen = circ * frac
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className='donut'>
      <circle cx={cx} cy={cy} r={r} fill='none' stroke='var(--teal-light)' strokeWidth='20' />
      <circle
        cx={cx}
        cy={cy}
        r={r}
        fill='none'
        stroke='var(--teal)'
        strokeWidth='20'
        strokeDasharray={`${usedLen} ${circ - usedLen}`}
        strokeLinecap='butt'
        transform={`rotate(-90 ${cx} ${cy})`}
      />
      <text x={cx} y={cy - 4} textAnchor='middle' className='donut__big'>
        {Math.round(frac * 100)}%
      </text>
      <text x={cx} y={cy + 18} textAnchor='middle' className='donut__sub'>
        {label}
      </text>
    </svg>
  )
}
