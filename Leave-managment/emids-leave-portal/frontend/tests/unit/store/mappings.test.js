import { mapRow, mapTeamRow, toBalances, EMPTY_BALANCES } from '../../../src/store/mappings'

// Pins the mappers currently inlined in store/AuthContext.jsx, verbatim.
describe('store/mappings', () => {
  const dbRow = {
    request_no: 'LV-2026-00007',
    employee_id: '11111111-2222-3333-4444-555555555555',
    start_date: '2026-03-02',
    end_date: '2026-03-06',
    days: '5',
    mode: 'Full Day',
    reason: 'Annual leave',
    status: 'Pending',
    requested_on: '2026-02-20',
    leave_types: { name: 'Paid Time Off' },
    employees: { full_name: 'Vikram Deshmukh', emp_no: 'EM-20810' },
  }

  it('mapRow projects a request row (id aliased from request_no)', () => {
    expect(mapRow(dbRow)).toEqual({
      id: 'LV-2026-00007',
      type: 'Paid Time Off',
      from: '2026-03-02',
      to: '2026-03-06',
      days: 5,
      mode: 'Full Day',
      reason: 'Annual leave',
      requestedOn: '2026-02-20',
      status: 'Pending',
    })
  })

  it('mapRow tolerates missing joined relations', () => {
    const { type } = mapRow({ ...dbRow, leave_types: null, employees: null })
    expect(type).toBe('')
  })

  it('mapTeamRow extends mapRow with employee fields', () => {
    const row = mapTeamRow(dbRow)
    expect(row.name).toBe('Vikram Deshmukh')
    expect(row.empId).toBe('EM-20810')
    expect(row.absenceType).toBe('Paid Time Off')
    expect(row.id).toBe('LV-2026-00007')
  })

  describe('toBalances', () => {
    it('exposes the canonical empty shape for pre-load rendering', () => {
      expect(EMPTY_BALANCES).toEqual({ totalCredited: 0, utilized: 0, rows: [] })
    })

    const balanceRow = {
      opening_annual: '5',
      annual_credited: '13',
      annual_utilized: '2.5',
      contingency_credited: '4',
      contingency_utilized: '1',
      contingency_cap: '10',
    }

    it('returns null for a missing row', () => {
      expect(toBalances(null)).toBeNull()
    })

    it('shapes totals and bar-chart rows (pinned, incl. chart maxima)', () => {
      expect(toBalances(balanceRow)).toEqual({
        totalCredited: 18,
        utilized: 2.5,
        rows: [
          { key: 'opening', label: 'Opening', value: 5, max: 12 },
          { key: 'credited', label: 'Credited', value: 13, max: 18 },
          { key: 'utilized', label: 'Utilized', value: 2.5, max: 18 },
          { key: 'available', label: 'Available', value: 15.5, max: 18 },
          { key: 'contUtilized', label: 'Cont. Utilized', value: 1, max: 10 },
          { key: 'contAvailable', label: 'Cont. Available', value: 3, max: 10 },
        ],
      })
    })

    it('clamps available at 0 and passes the DB contingency cap through', () => {
      const b = toBalances({ ...balanceRow, annual_utilized: '25', contingency_cap: '7' })
      expect(b.rows.find((r) => r.key === 'available').value).toBe(0)
      expect(b.rows.find((r) => r.key === 'contAvailable').max).toBe(7)
    })
  })
})
