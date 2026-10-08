// Row → view-model shapers for the leave_requests / leave_balances queries.
export { EMPTY_BALANCES } from '../features/balances/rules'

export const mapRow = (r) => ({
  id: r.request_no,
  type: r.leave_types?.name ?? '',
  from: r.start_date,
  to: r.end_date,
  days: Number(r.days),
  mode: r.mode,
  reason: r.reason,
  requestedOn: r.requested_on,
  status: r.status,
})

export const mapTeamRow = (r) => ({
  ...mapRow(r),
  name: r.employees?.full_name ?? '',
  empId: r.employees?.emp_no ?? '',
  absenceType: r.leave_types?.name ?? '',
})

export const toBalances = (row) => {
  if (!row) return null
  const opening = Number(row.opening_annual)
  const credited = Number(row.annual_credited)
  const utilized = Number(row.annual_utilized)
  const contCredited = Number(row.contingency_credited)
  const contUtilized = Number(row.contingency_utilized)
  const contCap = Number(row.contingency_cap)
  const total = opening + credited
  return {
    totalCredited: total,
    utilized,
    rows: [
      { key: 'opening', label: 'Opening', value: opening, max: 12 },
      { key: 'credited', label: 'Credited', value: credited, max: 18 },
      { key: 'utilized', label: 'Utilized', value: utilized, max: 18 },
      { key: 'available', label: 'Available', value: Math.max(0, total - utilized), max: 18 },
      { key: 'contUtilized', label: 'Cont. Utilized', value: contUtilized, max: contCap },
      { key: 'contAvailable', label: 'Cont. Available', value: Math.max(0, contCredited - contUtilized), max: contCap },
    ],
  }
}
