import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { AuthContext } from '../../../src/store/AuthContext'
import type { AuthContextValue } from '../../../src/store/AuthContext'
import type { BalanceSummary, EmployeeProfileRow, LeaveRequestRow, TeamRequestRow } from '../../../src/types/models'
import Layout from '../../../src/components/Layout'
import { STATUSES } from '../../../src/constants'
import type { ReactNode } from 'react'

const staffProfile = { initials: 'VD', full_name: 'Vikram Deshmukh', job_title: 'Consultant', emp_no: 'EM-20810', system_role: 'employee' } as unknown as EmployeeProfileRow
const managerProfile = { ...staffProfile, system_role: 'manager' } as unknown as EmployeeProfileRow
const balances: BalanceSummary = {
  totalCredited: 22,
  utilized: 4,
  rows: [
    { key: 'available', label: 'Available', value: 18, max: 18 },
    { key: 'contAvailable', label: 'Cont. Available', value: 7, max: 10 },
  ],
}

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

function PathProbe() {
  const location = useLocation()
  return <div data-testid="path-probe">{location.pathname}</div>
}

function setup({
  profile = staffProfile,
  team = [] as TeamRequestRow[],
  mine = [] as LeaveRequestRow[],
  balances: b = balances,
  signOut = vi.fn(async () => true),
  child = null as ReactNode,
}: {
  profile?: EmployeeProfileRow
  team?: TeamRequestRow[]
  mine?: LeaveRequestRow[]
  balances?: BalanceSummary
  signOut?: () => Promise<boolean>
  child?: ReactNode
} = {}) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthContext.Provider value={{ profile, team, mine, balances: b, signOut } as unknown as AuthContextValue}>
        <Routes>
          <Route path='*' element={<Layout>{child ?? <div>page-body</div>}</Layout>} />
          <Route path='/login' element={<div>login-here</div>} />
        </Routes>
      </AuthContext.Provider>
    </MemoryRouter>
  )
}

function openDrawer() {
  fireEvent.click(screen.getByRole('button', { name: 'Menu' }))
  return document.querySelector('.drawer') as HTMLElement
}

describe('components/Layout', () => {
  it('renders the pinned header, page body and the drawer nav with six links', () => {
    setup()
    expect(screen.getByText('Absence Management')).toBeInTheDocument()
    expect(screen.getByText('page-body')).toBeInTheDocument()
    const drawer = openDrawer()
    expect(drawer.getAttribute('class')).toContain('drawer')
    expect(screen.getByText('Dashboard')).toBeInTheDocument()
    expect(screen.getByText('Apply Leave')).toBeInTheDocument()
    expect(screen.getByText('My Requests')).toBeInTheDocument()
    expect(screen.getByText('Holiday Calendar')).toBeInTheDocument()
    expect(screen.getByText('Separation Request')).toBeInTheDocument()
  })

  it('hides the Leave Requests queue entry from plain employees but shows it for managers', () => {
    setup({ profile: staffProfile })
    openDrawer()
    expect(screen.queryByText('Leave Requests')).not.toBeInTheDocument()

    document.body.innerHTML = ''
    setup({ profile: managerProfile })
    openDrawer()
    expect(screen.getByText('Leave Requests')).toBeInTheDocument()
  })

  it('decorates the queue link with the pending badge from the team state', () => {
    setup({
      profile: managerProfile,
      team: [
        teamRow({ id: 'LV-1' }),
        teamRow({ id: 'LV-2' }),
        teamRow({ id: 'LV-3', status: STATUSES.Approved }),
      ],
    })
    openDrawer()
    const badge = document.querySelector('.nav-item__badge')!
    expect(badge).toHaveAttribute('title', '2 pending requests')
    expect(badge.textContent).toBe('2')
  })

  it('shows the annual and contingency counts in the drawer when balances exist', () => {
    setup()
    openDrawer()
    const counts = document.querySelectorAll('.drawer__count b')
    expect(counts[0].textContent.replace(/\s/g, ' ')).toContain('18')
    expect(counts[1]).toBeInTheDocument()
  })

  it('opens the profile dialog from the header avatar control', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByTitle('My profile'))
    expect(screen.getByRole('dialog', { name: 'My profile' })).toBeInTheDocument()
  })

  it('navigates to login when sign-out succeeds', async () => {
    const user = userEvent.setup()
    const signOut = vi.fn(async () => true)
    setup({ signOut })
    openDrawer()
    await user.click(screen.getByRole('button', { name: /Log out/ }))
    expect(screen.getByText('login-here')).toBeInTheDocument()
  })

  it('stays on the page when sign-out fails', async () => {
    const user = userEvent.setup()
    const signOut = vi.fn(async () => false)
    setup({ signOut })
    openDrawer()
    await user.click(screen.getByRole('button', { name: /Log out/ }))
    expect(screen.queryByText('login-here')).toBeNull()
  })

  it('opens the demo AI assistant via the floating button', async () => {
    const user = userEvent.setup()
    setup()
    await user.click(screen.getByRole('button', { name: 'AI assistant' }))
    expect(screen.getByRole('dialog', { name: 'AI assistant' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Close assistant' }))
    expect(screen.queryByRole('dialog', { name: 'AI assistant' })).toBeNull()
  })

  it('opens the search dialog from the header control and navigates on Enter', async () => {
    const user = userEvent.setup()
    setup({ child: <PathProbe /> })
    await user.click(screen.getByRole('button', { name: 'Search' }))
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
    await user.type(screen.getByLabelText('Search portal'), 'holiday{enter}')
    expect(screen.getByTestId('path-probe').textContent).toBe('/holidays')
    expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull()
  })

  it('opens the search dialog with the "/" hotkey', () => {
    setup()
    expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull()
    fireEvent.keyDown(document, { key: '/' })
    expect(screen.getByRole('dialog', { name: 'Search' })).toBeInTheDocument()
  })

  it('does not hijack "/" typed into a normal page input', () => {
    setup({ child: <input aria-label="Page search" /> })
    fireEvent.keyDown(screen.getByLabelText('Page search'), { key: '/' })
    expect(screen.queryByRole('dialog', { name: 'Search' })).toBeNull()
  })

  it('shows the true notification backlog on the bell and opens the real dialog', async () => {
    const user = userEvent.setup()
    setup({
      profile: managerProfile,
      team: [
        teamRow({ id: 'LV-T1', name: 'Priya Nair', absenceType: 'Annual Leave' }),
        teamRow({ id: 'LV-T2', name: 'Ashok Verma', absenceType: 'Work From Home' }),
        teamRow({ id: 'LV-T3', status: STATUSES.Approved }),
      ],
    })
    // no static dot — only real backlog (2 pending) produces a cue
    expect(document.querySelector('.icon-btn__count')!.textContent).toBe('2')
    await user.click(screen.getByRole('button', { name: 'Notifications (2 new)' }))
    expect(screen.getByRole('dialog', { name: 'Notifications' })).toBeInTheDocument()
    expect(screen.getByText('Priya Nair — Annual Leave')).toBeInTheDocument()
    expect(screen.getByText('Ashok Verma — Work From Home')).toBeInTheDocument()
  })

  it('marks notifications seen on open so the badge resets after dismissing', async () => {
    const user = userEvent.setup()
    setup({
      profile: managerProfile,
      team: [
        teamRow({ id: 'LV-T1' }),
        teamRow({ id: 'LV-T2', status: STATUSES.Approved }),
      ],
    })
    expect(document.querySelector('.icon-btn__count')!.textContent).toBe('1')
    await user.click(screen.getByRole('button', { name: /^Notifications/ }))
    await user.click(screen.getByRole('button', { name: 'Close notifications' }))
    expect(document.querySelector('.icon-btn__count')).toBeNull()
  })

  it('shows no badge and the caught-up dialog for a clean session', async () => {
    const user = userEvent.setup()
    setup()
    expect(document.querySelector('.icon-btn__count')).toBeNull()
    await user.click(screen.getByRole('button', { name: 'Notifications' }))
    expect(screen.getByText('You’re all caught up.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Close notifications' })).toBeInTheDocument()
  })

  it('surfaces decided own requests as employee notifications routing to history', async () => {
    const user = userEvent.setup()
    setup({
      mine: [mineRow({ status: STATUSES.Approved, id: 'LV-2026-00003' })],
      child: <PathProbe />,
    })
    expect(document.querySelector('.icon-btn__count')!.textContent).toBe('1')
    await user.click(screen.getByRole('button', { name: 'Notifications (1 new)' }))
    const row = screen.getByText('LV-2026-00003 — Annual Leave').closest('.notif-item')!
    await user.click(row)
    expect(screen.getByTestId('path-probe').textContent).toBe('/leave-details')
  })

  it('employees never surface team-based search hits even with backlogged team data', async () => {
    const user = userEvent.setup()
    setup({
      profile: staffProfile,
      team: [teamRow({ status: STATUSES.Pending })],
    })
    await user.click(screen.getByRole('button', { name: 'Search' }))
    await user.type(screen.getByLabelText('Search portal'), 'priya')
    expect(screen.getByText(/No matches for “priya”/)).toBeInTheDocument()
  })
})
