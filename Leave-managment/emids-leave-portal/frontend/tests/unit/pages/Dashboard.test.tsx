import type { BalanceSummary, EmployeeProfileRow } from '../../../src/types/models'
import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { MemoryRouter } from 'react-router-dom'

vi.mock('../../../src/services/holidays', () => ({
  fetchUpcomingHolidays: vi.fn(),
  fetchOptionalPicks: vi.fn(),
}))

import { fetchUpcomingHolidays, fetchOptionalPicks } from '../../../src/services/holidays'
import { AuthContext, type AuthContextValue } from '../../../src/store/AuthContext'
import Dashboard from '../../../src/pages/Dashboard'

const balances = {
  totalCredited: 20,
  utilized: 5,
  rows: [{ key: 'available', value: 15, max: 18 }],
}

// Effects run on mount, so mock behavior is pinned BEFORE rendering.
function setup({ balances: b = balances, setToast = vi.fn(), upcoming = () => new Promise(() => {}), picks = () => new Promise(() => {}) } = {}) {
  vi.mocked(fetchUpcomingHolidays).mockImplementation(upcoming as never)
  vi.mocked(fetchOptionalPicks).mockImplementation(picks as never)
  render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthContext.Provider value={{ profile: { id: 'e-me', location: 'Bangalore' } as unknown as EmployeeProfileRow, balances: b as unknown as BalanceSummary, setToast } as unknown as AuthContextValue}>
        <Dashboard />
      </AuthContext.Provider>
    </MemoryRouter>
  )
  return setToast
}

describe('pages/Dashboard — async guard behavior', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('survives a rejected holiday fetch without crashing or toasting', async () => {
    setup({ upcoming: () => Promise.reject(new TypeError('Failed to fetch')) })
    await waitFor(() => expect(fetchUpcomingHolidays).toHaveBeenCalledTimes(1))
    expect(screen.queryByText(/Next holiday/)).not.toBeInTheDocument()
  })

  it('reports an in-band holiday fetch failure and still renders the page frame', async () => {
    const setToast = setup({
      upcoming: () => Promise.resolve({ rows: [], error: { code: 'PGRST116', context: 'upcoming holidays', userMessage: 'holidays offline' } }),
    })
    await waitFor(() => expect(setToast).toHaveBeenCalledWith('holidays offline', 'red'))
    expect(screen.getByText(/Need a hand with time off/)).toBeInTheDocument()
  })

  it('does not discard a rejected optional-picks secondary read', async () => {
    setup({
      upcoming: () => Promise.resolve({ rows: [{ id: 1, kind: 'optional', holiday_date: '2099-12-25', name: 'Diwali', location: 'Bangalore' }], error: null }),
      picks: () => Promise.reject(new TypeError('Failed to fetch')),
    })
    await waitFor(() => expect(fetchOptionalPicks).toHaveBeenCalledWith('e-me'))
    expect(screen.queryByText(/Next holiday/)).not.toBeInTheDocument()
  })
})
