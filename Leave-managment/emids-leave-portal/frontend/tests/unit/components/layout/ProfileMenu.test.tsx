import { render, screen, fireEvent } from '@testing-library/react'
import ProfileMenu from '../../../../src/components/layout/ProfileMenu'
import type { EmployeeProfileRow } from '../../../../src/types/models'

const fullProfile = {
  initials: 'PM',
  full_name: 'Prastina Mary',
  job_title: 'Manager',
  system_role: 'manager',
  email: 'prastina.mary@emids.com',
  emp_no: 'EM-10001',
  account: 'Humana',
  project_name: 'Portal Revamp',
  function_name: 'Engineering',
  manager: { full_name: 'Sandeep Venkatesh Kamath' },
} as unknown as EmployeeProfileRow

function renderMenu({ profile = fullProfile, onDismiss = vi.fn() }: { profile?: EmployeeProfileRow | null; onDismiss?: () => void } = {}) {
  const view = render(<ProfileMenu profile={profile} onDismiss={onDismiss} />)
  return { onDismiss, ...view }
}

describe('layout/ProfileMenu', () => {
  it('renders the dialog semantics with the who-am-i block', () => {
    renderMenu()
    const pop = document.querySelector('.profile-pop')
    expect(pop).toHaveAttribute('role', 'dialog')
    expect(pop).toHaveAttribute('aria-label', 'My profile')
    expect(document.querySelector('.pop-backdrop')).toBeInTheDocument()
    expect(screen.getByText('Prastina Mary')).toBeInTheDocument()
    expect(screen.getByText(/Manager · manager/)).toBeInTheDocument()
    expect(screen.getByText('prastina.mary@emids.com')).toBeInTheDocument()
    expect(screen.getByText('PM')).toBeInTheDocument()
  })

  it('lists the five profile fields with their values, including the manager name', () => {
    renderMenu()
    for (const label of ['Emp ID', 'Account', 'Project', 'Function', 'Manager']) {
      expect(screen.getByText(label)).toBeInTheDocument()
    }
    expect(screen.getByText('EM-10001')).toBeInTheDocument()
    expect(screen.getByText('Humana')).toBeInTheDocument()
    expect(screen.getByText('Portal Revamp')).toBeInTheDocument()
    expect(screen.getByText('Engineering')).toBeInTheDocument()
    expect(screen.getByText('Sandeep Venkatesh Kamath')).toBeInTheDocument()
  })

  it('falls back to an em dash for missing values', () => {
    renderMenu({
      profile: { full_name: 'Guest Person', email: 'guest@emids.com', system_role: 'employee' } as unknown as EmployeeProfileRow,
    })
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBe(5) // the five detail values (avatar renders empty without initials)
  })

  it('dismisses on Escape (dialog contract)', () => {
    const onDismiss = vi.fn()
    renderMenu({ onDismiss })
    fireEvent.keyDown(document, { key: 'Escape' })
    expect(onDismiss).toHaveBeenCalledTimes(1)
  })

  it('dismisses on outside mousedown but not on clicks inside the panel', () => {
    const onDismiss = vi.fn()
    renderMenu({ onDismiss })
    fireEvent.mouseDown(document.body)
    expect(onDismiss).toHaveBeenCalledTimes(1)

    onDismiss.mockClear()
    fireEvent.mouseDown(document.querySelector('.profile-pop')!)
    expect(onDismiss).not.toHaveBeenCalled()
  })
})
