import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'

vi.mock('../../../../src/services/holidays', () => ({
  fetchOptionalPicks: vi.fn(),
  fetchAllHolidays: vi.fn(),
  addOptionalPick: vi.fn(),
  removeOptionalPick: vi.fn(),
  isPickCapError: vi.fn(),
}))
vi.mock('../../../../src/services/legacyMigration', () => ({
  migrateLegacyPicks: vi.fn(),
}))
vi.mock('../../../../src/data/legacyHolidayData', () => ({ legacyHolidayData: [] }))

import {
  fetchOptionalPicks,
  addOptionalPick,
  removeOptionalPick,
  isPickCapError,
} from '../../../../src/services/holidays'
import { migrateLegacyPicks } from '../../../../src/services/legacyMigration'
import { useHolidayPicks } from '../../../../src/features/holidays/useHolidayPicks'
import { TOAST_KIND, MAX_PICKS } from '../../../../src/constants'

const profile = { id: 'e-me' }
const setToast = vi.fn()
const rows = [
  { id: 1, kind: 'optional', country: 'India', year: 2026, name: 'A' },
  { id: 2, kind: 'optional', country: 'India', year: 2026, name: 'B' },
  { id: 3, kind: 'fixed', country: 'India', year: 2026, name: 'C', location: 'Bangalore' },
]
const capped = [
  ...rows,
  ...Array.from({ length: MAX_PICKS }, (_, i) => ({ id: 100 + i, kind: 'optional', country: 'India', year: 2026, name: `X${i}` })),
]

function Harness({ country = 'India', year = 2026, all = rows }) {
  const { picks, chosen, togglePick } = useHolidayPicks({ profile, setToast, all, country, year })
  return (
    <div>
      <div data-testid='picks'>{picks ? [...picks].sort().join(',') : 'null'}</div>
      <div data-testid='chosen'>{chosen.map((c) => c.id).join(',')}</div>
      <button data-testid='t-1' onClick={() => togglePick(all[0])}>toggle-1</button>
      <button data-testid='t-2' onClick={() => togglePick(all[1])}>toggle-2</button>
    </div>
  )
}

describe('features/holidays/useHolidayPicks', () => {
  beforeEach(() => {
    vi.mocked(fetchOptionalPicks).mockReset().mockResolvedValue({ holidayIds: [], error: null })
    vi.mocked(addOptionalPick).mockReset().mockResolvedValue({ error: null })
    vi.mocked(removeOptionalPick).mockReset().mockResolvedValue({ error: null })
    vi.mocked(isPickCapError).mockReset().mockReturnValue(false)
    vi.mocked(migrateLegacyPicks).mockReset().mockResolvedValue({ inserted: false, pickedIds: [] })
    setToast.mockReset()
  })

  it('loads the employee picks on mount', async () => {
    vi.mocked(fetchOptionalPicks).mockResolvedValue({ holidayIds: [1, 2], error: null })
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('picks').textContent).toBe('1,2'))
    expect(fetchOptionalPicks).toHaveBeenCalledWith('e-me')
  })

  it('adds a pick below the cap without a toast', async () => {
    const user = userEvent.setup()
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('picks').textContent).toBe(''))
    await user.click(screen.getByTestId('t-1'))
    await waitFor(() => expect(screen.getByTestId('picks').textContent).toBe('1'))
    expect(addOptionalPick).toHaveBeenCalledWith('e-me', 1)
    expect(setToast).not.toHaveBeenCalled()
  })

  it('blocks a pick beyond the cap with the legacy wording and no service call', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchOptionalPicks).mockResolvedValue({ holidayIds: [100, 101, 102], error: null })
    render(<Harness all={capped} />)
    await waitFor(() => expect(screen.getByTestId('picks').textContent).toBe('100,101,102'))
    await user.click(screen.getByTestId('t-1'))
    expect(addOptionalPick).not.toHaveBeenCalled()
    await waitFor(() =>
      expect(setToast).toHaveBeenCalledWith(`You can choose only ${MAX_PICKS} optional holidays`, TOAST_KIND.Error)
    )
  })

  it('removes a pick optimistically without a toast', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchOptionalPicks).mockResolvedValue({ holidayIds: [1, 2], error: null })
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('picks').textContent).toBe('1,2'))
    await user.click(screen.getByTestId('t-1'))
    await waitFor(() => expect(screen.getByTestId('picks').textContent).toBe('2'))
    expect(removeOptionalPick).toHaveBeenCalledWith('e-me', 1)
    expect(setToast).not.toHaveBeenCalled()
  })

  it('recovers with a refetch when removal fails', async () => {
    const user = userEvent.setup()
    vi.mocked(fetchOptionalPicks)
      .mockResolvedValueOnce({ holidayIds: [1, 2], error: null })
      .mockResolvedValueOnce({ holidayIds: [2], error: null })
    vi.mocked(removeOptionalPick).mockResolvedValue({ error: { code: '23503', context: 'pick', userMessage: 'boom' } })
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('picks').textContent).toBe('1,2'))
    await user.click(screen.getByTestId('t-1'))
    await waitFor(() => expect(screen.getByTestId('picks').textContent).toBe('2'))
    await waitFor(() => expect(setToast).toHaveBeenCalledWith('boom', TOAST_KIND.Error))
  })

  it('shows the cap message when the DB rejects with the pick-cap error', async () => {
    const user = userEvent.setup()
    vi.mocked(addOptionalPick).mockResolvedValue({ error: { code: 'P0001', context: 'pick', userMessage: 'cap' } })
    vi.mocked(isPickCapError).mockReturnValue(true)
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('picks').textContent).toBe(''))
    await user.click(screen.getByTestId('t-2'))
    expect(addOptionalPick).toHaveBeenCalledWith('e-me', 2)
    await waitFor(() =>
      expect(setToast).toHaveBeenCalledWith(`You can choose only ${MAX_PICKS} optional holidays`, TOAST_KIND.Error)
    )
  })

  it('replays the legacy migration and adopts migrated picks', async () => {
    // inserted:true exactly once — the real service is bounded (it only inserts
    // missing rows), and re-surplus answers would re-fire the picks effect forever.
    vi.mocked(migrateLegacyPicks)
      .mockResolvedValueOnce({ inserted: true, pickedIds: [3] })
      .mockResolvedValue({ inserted: false, pickedIds: [] })
    render(<Harness />)
    await waitFor(() => expect(screen.getByTestId('picks').textContent).toBe('3'))
    expect(migrateLegacyPicks).toHaveBeenCalledWith(
      expect.objectContaining({ employeeId: 'e-me', pickedIds: [] })
    )
  })
})
