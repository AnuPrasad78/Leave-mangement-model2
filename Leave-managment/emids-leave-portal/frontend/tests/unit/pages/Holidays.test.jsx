import { render, screen, waitFor } from '@testing-library/react'
import { vi } from 'vitest'

vi.mock('../../../src/services/holidays', () => ({
  fetchAllHolidays: vi.fn(),
  fetchOptionalPicks: vi.fn(),
  addOptionalPick: vi.fn(),
  removeOptionalPick: vi.fn(),
  isPickCapError: vi.fn(),
}))

import { fetchAllHolidays, fetchOptionalPicks } from '../../../src/services/holidays'
import { AuthContext } from '../../../src/store/AuthContext'
import Holidays from '../../../src/pages/Holidays'

// Effects run on mount, so every test pins the mock behavior BEFORE rendering.
function setup({ profile = null, behavior = () => new Promise(() => {}) } = {}) {
  vi.mocked(fetchAllHolidays).mockImplementation(behavior)
  const setToast = vi.fn()
  render(
    <AuthContext.Provider value={{ setToast, profile }}>
      <Holidays />
    </AuthContext.Provider>
  )
  return setToast
}

describe('pages/Holidays — async guard behavior', () => {
  beforeEach(() => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
  })
  afterEach(() => vi.restoreAllMocks())

  it('renders the filters and both tables while the calendar loads', () => {
    setup() // never-resolving default keeps the optimistic loading copy on screen
    expect(screen.getByLabelText('Country')).toBeInTheDocument()
    expect(screen.getAllByText('Loading calendar…').length).toBe(2)
  })

  it('reports an in-band calendar failure and falls back to the empty copy', async () => {
    const setToast = setup({
      behavior: () => Promise.resolve({ rows: [], error: { code: 'unknown', context: 'holidays lookup', userMessage: 'calendar offline' } }),
    })
    await waitFor(() => expect(setToast).toHaveBeenCalledWith('calendar offline', 'red'))
    expect(screen.getAllByText('No holidays on file.').length).toBe(2)
  })

  it('survives a rejected calendar fetch without crashing', async () => {
    setup({ behavior: () => Promise.reject(new TypeError('Failed to fetch')) })
    await waitFor(() => expect(screen.getAllByText('No holidays on file.').length).toBe(2))
    expect(screen.getByText(/CHOSEN/)).toBeInTheDocument()
  })

  it('loads picks for a signed-in profile without discarding a rejected picks read', async () => {
    vi.mocked(fetchOptionalPicks).mockRejectedValue(new TypeError('Failed to fetch'))
    setup({ profile: { id: 'e-me' }, behavior: () => Promise.resolve({ rows: [], error: null }) })
    await waitFor(() => expect(fetchOptionalPicks).toHaveBeenCalledWith('e-me'))
    expect(screen.getByText(/CHOSEN/)).toBeInTheDocument()
  })
})
