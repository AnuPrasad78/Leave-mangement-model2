// Canonical day formatter: bare for whole days, 2 decimals otherwise.
export const fmtDays = (v: number): string => (Number.isInteger(v) ? String(v) : v.toFixed(2))
