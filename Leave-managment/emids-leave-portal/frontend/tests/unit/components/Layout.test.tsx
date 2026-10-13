import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { AuthContext } from '../../../src/store/AuthContext'
import type { AuthContextValue } from '../../../src/store/AuthContext'
import type { BalanceSummary, EmployeeProfileRow, TeamRequestRow } from '../../../src/types/models'
import Layout from '../../../src/components/Layout'

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

function setup({ profile = staffProfile, team = [], balances: b = balances, signOut = vi.fn(async () => true) }: { profile?: EmployeeProfileRow; team?: TeamRequestRow[]; balances?: BalanceSummary; signOut?: () => Promise<boolean> } = {}) {
  return render(
    <MemoryRouter initialEntries={['/dashboard']}>
      <AuthContext.Provider value={{ profile, team, balances: b, signOut } as unknown as AuthContextValue}>
        <Routes>
          <Route path='*' element={<Layout><div>page-body</div></Layout>} />
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
      team: [{ id: 'LV-1', status: 'Pending' }, { id: 'LV-2', status: 'Pending' }, { id: 'LV-3', status: 'Approved' }] as unknown as TeamRequestRow[],
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
})
