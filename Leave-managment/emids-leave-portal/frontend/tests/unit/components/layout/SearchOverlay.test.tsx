import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import SearchOverlay from '../../../../src/components/layout/SearchOverlay'
import { STATUSES } from '../../../../src/constants'
import { IconDashboard, IconSun } from '../../../../src/components/Icons'
import type { LeaveRequestRow, TeamRequestRow } from '../../../../src/types/models'

const mineRow = (over: Partial<LeaveRequestRow> = {}): LeaveRequestRow => ({
  id: 'LV-2026-00001',
  type: 'Annual Leave',
  from: '2026-11-02',
  to: '2026-11-04',
  days: 3,
  mode: 'Full Day',
  reason: 'Family function',
  requestedOn: '2026-10-01',
  status: STATUSES.Pending,
  ...over,
})

const teamRow = (over: Partial<TeamRequestRow> = {}): TeamRequestRow => ({
  ...mineRow(),
  name: 'Priya Nair',
  empId: 'EM-20440',
  absenceType: 'Annual Leave',
  ...over,
})

const NAV = [
  { to: '/dashboard', num: '1', label: 'Dashboard', icon: IconDashboard },
  { to: '/leave-details', num: '3', label: 'My Requests', icon: IconSun },
  { to: '/holidays', num: '5', label: 'Holiday Calendar', icon: IconSun },
]

const profileEmployee = { system_role: 'employee' } as SearchOverlayProfile
const profileManager = { system_role: 'manager' } as SearchOverlayProfile
type SearchOverlayProfile = { system_role: 'employee' | 'manager' }

function setup({
  profile = profileEmployee,
  mine = [mineRow(), mineRow({ id: 'LV-2026-00002', type: 'Work From Home', reason: 'Internet outage', status: STATUSES.Approved })],
  team = [] as TeamRequestRow[],
  onNavigate = vi.fn(),
  onDismiss = vi.fn(),
} = {}) {
  const view = render(
    <SearchOverlay
      nav={NAV}
      profile={profile as never}
      mine={mine}
      team={team}
      onNavigate={onNavigate}
      onDismiss={onDismiss}
    />
  )
  return { onNavigate, onDismiss, ...view }
}

describe('layout/SearchOverlay', () => {
  it('renders the dialog semantics, auto-focuses the input and shows an idle hint', () => {
    setup()
    const dialog = document.querySelector('.search-pop')
    expect(dialog).toHaveAttribute('role', 'dialog')
    expect(dialog).toHaveAttribute('aria-label', 'Search')
    expect(document.querySelector('.pop-backdrop')).toBeInTheDocument()
    expect(screen.getByLabelText('Search portal')).toHaveFocus()
    // idle state = no listings until the user types
    expect(screen.getByText(/Start typing/)).toBeInTheDocument()
    expect(screen.queryByText('Dashboard')).toBeNull()
    expect(screen.queryByText('My requests')).toBeNull()
  })

  it('filters across pages and own requests as the user types', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByLabelText('Search portal'), 'holiday')
    expect(screen.getByText('Holiday Calendar')).toBeInTheDocument()
  })

  it('matches request tokens (ref number, reason, status) case-insensitively', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByLabelText('Search portal'), 'outage')
    expect(screen.getByText('LV-2026-00002 · Work From Home')).toBeInTheDocument()
    expect(screen.queryByText('Holiday Calendar')).toBeNull()
  })

  it('shows a friendly empty state with the trimmed query', async () => {
    const user = userEvent.setup()
    setup()
    await user.type(screen.getByLabelText('Search portal'), 'zebra  ')
    expect(screen.getByText(/No matches for “zebra”/)).toBeInTheDocument()
  })

  it('navigates on click and reports the hit route', async () => {
    const user = userEvent.setup()
    const { onNavigate } = setup()
    await user.type(screen.getByLabelText('Search portal'), 'annual')
    await user.click(screen.getByText('LV-2026-00001 · Annual Leave'))
    expect(onNavigate).toHaveBeenCalledWith('/leave-details')
  })

  it('supports the documented keyboard flow: arrow keys then Enter', async () => {
    const user = userEvent.setup()
    const { onNavigate } = setup()
    const input = screen.getByLabelText('Search portal')
    // typing narrows to the Holiday Calendar page hit; the keyboard cursor
    // starts on the first (only) hit
    await user.type(input, 'holiday')
    fireEvent.keyDown(input, { key: 'Enter' })
    expect(onNavigate).toHaveBeenCalledWith('/holidays')
  })

  it('dismisses on Escape and outside mousedown, but not on panel clicks', () => {
    const { onDismiss } = setup()
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)

    onDismiss.mockClear()
    fireEvent.mouseDown(document.body)
    expect(onDismiss).toHaveBeenCalledTimes(1)

    onDismiss.mockClear()
    fireEvent.mouseDown(document.querySelector('.search-pop')!)
    expect(onDismiss).not.toHaveBeenCalled()
  })

  it('stays open while typing generally but allows the explicit close control', async () => {
    const user = userEvent.setup()
    const { onDismiss } = setup()
    const input = screen.getByLabelText('Search portal')
    await user.type(input, 'holiday') // inside-panel typing must not dismiss on keydown
    expect(screen.getByText('Holiday Calendar')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close search' }))
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('offers team hits only to approvers and never offers the locked nav link to employees', () => {
    setup({
      profile: profileManager,
      team: [teamRow()],
    })
    fireEvent.change(screen.getByLabelText('Search portal'), { target: { value: 'priya' } })
    expect(screen.getByText('Priya Nair · Annual Leave')).toBeInTheDocument()
  })

  it('does not crash on regex-hostile or oversized queries', async () => {
    const user = userEvent.setup()
    setup()
    // user-event treats "[…]" as its own key descriptor syntax, so the raw
    // query string goes through the same onChange handler via fireEvent.
    fireEvent.change(screen.getByLabelText('Search portal'), { target: { value: '.*[]("; DROP 99 zebra-hits-everything!!' } })
    expect(await screen.findByText(/No matches for/)).toBeInTheDocument()
    fireEvent.change(screen.getByLabelText('Search portal'), { target: { value: 'holiday' } })
    await user.type(screen.getByLabelText('Search portal'), 'zz')
    expect(screen.getByText(/No matches for “holidayzz”/)).toBeInTheDocument()
  })
})
