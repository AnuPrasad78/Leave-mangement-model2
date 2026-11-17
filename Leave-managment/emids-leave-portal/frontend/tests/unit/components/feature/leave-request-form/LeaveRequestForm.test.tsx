import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { todayISO } from '@/utils/dates'
import { MODES } from '@/constants'
import LeaveRequestForm from '@/components/feature/leave-request-form/LeaveRequestForm'
import type { BalanceSummary, LeaveRequestInput, LeaveRequestRow, LeaveRequestUpdateInput } from '@/types/models'

const leaveTypes = ['Paid Time Off', 'Work From Home']
const optionalLeaveTypes = ['Paid Time Off', 'Optional Holiday']
const balances: BalanceSummary = {
  totalCredited: 20,
  utilized: 5,
  rows: [{ key: 'available', label: 'Available', value: 15, max: 18 }],
}

function setup({ addMine = vi.fn(async () => 'LV-100'), balances: b = balances, onError = vi.fn() }: { addMine?: (input: LeaveRequestInput) => Promise<string | null>; balances?: BalanceSummary; onError?: (message: string) => void } = {}) {
  const onSubmitted = vi.fn()
  const onCancel = vi.fn()
  render(
    <LeaveRequestForm
      leaveTypes={leaveTypes}
      balances={b}
      addMine={addMine}
      onSubmitted={onSubmitted}
      onCancel={onCancel}
      onError={onError}
    />
  )
  return { onSubmitted, onCancel, addMine }
}

describe('components/feature/LeaveRequestForm', () => {
  it('renders the pinned form markup with leave-type chips', () => {
    setup()
    expect(document.querySelector('.form-card')).toBeInTheDocument()
    for (const t of leaveTypes) expect(screen.getByRole('button', { name: t })).toBeInTheDocument()
    expect(screen.getByLabelText(/From Date/)).toBeInTheDocument()
    expect(screen.getByLabelText(/To Date/)).toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Day mode' })).toBeInTheDocument()
    expect(screen.getByLabelText(/Reason/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Submit Request' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument()
  })

  it('surfaces the validation rules on submit', async () => {
    const user = userEvent.setup()
    setup({ addMine: vi.fn(async () => null) })
    await user.click(screen.getByRole('button', { name: 'Submit Request' }))
    expect(screen.queryByText('Select a leave type.')).not.toBeInTheDocument() // default type chip preselected
    // From/To errors render as one combined full-width line under the dates row.
    expect(screen.getByText('Pick a from date. Pick a to date.')).toBeInTheDocument()
    expect(screen.getByText('Tell the approver why, in a line or two.')).toBeInTheDocument()
  })

  it('disables submit when the stored balance is overdrawn', () => {
    const addMine = vi.fn(async () => 'LV-x')
    setup({ addMine, balances: { totalCredited: 12, utilized: 14, rows: [{ key: 'available', label: 'Available', value: 0, max: 18 }] } })
    const btn = screen.getByRole('button', { name: 'Submit Request' })
    expect(btn).toBeDisabled()
    expect(btn.title).toContain('People Success')
  })

  it('submits the payload and publishes the success message', async () => {
    const user = userEvent.setup()
    const addMine = vi.fn(async () => 'LV-100')
    const { onSubmitted } = setup({ addMine })

    fireEvent.change(screen.getByLabelText(/From Date/), { target: { value: '2026-10-12' } })
    fireEvent.change(screen.getByLabelText(/To Date/), { target: { value: '2026-10-13' } })
    await user.type(screen.getByLabelText(/Reason/), 'Cousin wedding out of town')
    await user.click(screen.getByRole('button', { name: 'Submit Request' }))

    expect(addMine).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'Paid Time Off',
        from: '2026-10-12',
        to: '2026-10-13',
        days: 2,
        mode: MODES.Full,
        reason: 'Cousin wedding out of town',
        requestedOn: todayISO(),
      })
    )
    await waitFor(() =>
      expect(onSubmitted).toHaveBeenCalledWith('Paid Time Off request submitted · 2 day(s)')
    )
  })

  it('publishes nothing when the mutation fails', async () => {
    const user = userEvent.setup()
    const onSubmitted = setup({ addMine: vi.fn(async () => null) }).onSubmitted

    fireEvent.change(screen.getByLabelText(/From Date/), { target: { value: '2026-10-12' } })
    fireEvent.change(screen.getByLabelText(/To Date/), { target: { value: '2026-10-13' } })
    await user.type(screen.getByLabelText(/Reason/), 'Cousin wedding out of town')
    await user.click(screen.getByRole('button', { name: 'Submit Request' }))

    await waitFor(() => expect(screen.queryByText('Tell the approver why, in a line or two.')).toBeNull())
    expect(onSubmitted).not.toHaveBeenCalled()
  })

  it('prepopulates and updates an existing request without changing its submission date', async () => {
    const user = userEvent.setup()
    const request: LeaveRequestRow = {
      id: 'LV-1',
      type: 'Paid Time Off',
      from: '2026-10-12',
      to: '2026-10-13',
      days: 2,
      mode: MODES.Full,
      reason: 'Original reason',
      requestedOn: '2026-10-01',
      status: 'Pending',
    }
    const updateMine = vi.fn(async (_id: string, _input: LeaveRequestUpdateInput) => true)
    const onSubmitted = vi.fn()
    render(
      <LeaveRequestForm
        leaveTypes={leaveTypes}
        balances={balances}
        addMine={vi.fn(async () => null)}
        updateMine={updateMine}
        editRequest={request}
        onSubmitted={onSubmitted}
        onCancel={vi.fn()}
        onError={vi.fn()}
      />
    )

    expect(screen.getByLabelText(/From Date/)).toHaveValue('2026-10-12')
    expect(screen.getByLabelText(/To Date/)).toHaveValue('2026-10-13')
    expect(screen.getByLabelText(/Reason/)).toHaveValue('Original reason')
    fireEvent.change(screen.getByLabelText(/From Date/), { target: { value: '2026-10-14' } })
    fireEvent.change(screen.getByLabelText(/To Date/), { target: { value: '2026-10-15' } })
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(updateMine).toHaveBeenCalledWith('LV-1', {
      type: 'Paid Time Off',
      from: '2026-10-14',
      to: '2026-10-15',
      days: 2,
      mode: MODES.Full,
      reason: 'Original reason',
    })
    expect(onSubmitted).toHaveBeenCalledWith(expect.stringContaining('updated'))
  })
})

describe('components/feature/LeaveRequestForm — Optional Holiday', () => {
  function iso(offsetDays: number): string {
    const base = new Date(todayISO() + 'T00:00:00')
    base.setDate(base.getDate() + offsetDays)
    return `${base.getFullYear()}-${String(base.getMonth() + 1).padStart(2, '0')}-${String(base.getDate()).padStart(2, '0')}`
  }

  const optionalHolidays = new Map([[iso(30), 'Guru Nanak Jayanti']])

  function setupOptional(overrides: Partial<Parameters<typeof LeaveRequestForm>[0]> = {}) {
    const addMine = vi.fn(async () => 'LV-200')
    render(
      <LeaveRequestForm
        leaveTypes={optionalLeaveTypes}
        balances={balances}
        optionalHolidays={optionalHolidays}
        mine={[]}
        optionalAllowance={3}
        addMine={addMine}
        onSubmitted={vi.fn()}
        onCancel={vi.fn()}
        onError={vi.fn()}
        {...overrides}
      />
    )
    return addMine
  }

  it('shows one calendar instead of From/To and the allowance next to the type', async () => {
    const user = userEvent.setup()
    setupOptional()
    await user.click(screen.getByRole('button', { name: 'Optional Holiday' }))

    expect(screen.queryByLabelText(/From Date/)).not.toBeInTheDocument()
    expect(screen.queryByLabelText(/To Date/)).not.toBeInTheDocument()
    expect(screen.getByRole('group', { name: 'Optional holiday picker' })).toBeInTheDocument()
    expect(screen.getByText(/Remaining: 3 out of 3 Optional Holidays/)).toBeInTheDocument()
    // The regular balance block stays hidden: optional holidays never touch it.
    expect(screen.queryByText(/Remaining \d/)).not.toBeInTheDocument()
  })

  it('submits one day for the configured holiday and decrements the allowance', async () => {
    const user = userEvent.setup()
    const mine: LeaveRequestRow[] = []
    const addMine = setupOptional({ mine })
    await user.click(screen.getByRole('button', { name: 'Optional Holiday' }))
    // The configured holiday sits in next month; step the picker over.
    await user.click(screen.getByRole('button', { name: 'Next month' }))
    await user.click(screen.getByRole('button', { name: `${iso(30)} — Guru Nanak Jayanti` }))

    expect(screen.getByText(/Remaining: 3 out of 3 Optional Holidays/)).toBeInTheDocument()
    expect(screen.getByText(/Selected/)).toHaveTextContent('Selected 1 day')

    await user.type(screen.getByLabelText(/Reason/), 'Festival at home with family')
    await user.click(screen.getByRole('button', { name: 'Submit Request' }))

    expect(addMine).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'Optional Holiday', from: iso(30), to: iso(30), days: 1, mode: MODES.Full })
    )
  })

  it('blocks submitting a date that is not a configured optional holiday', async () => {
    const user = userEvent.setup()
    // Edit-existing flow: the stored date is (no longer) a configured holiday.
    const unconfigured: LeaveRequestRow = {
      id: 'LV-9',
      type: 'Optional Holiday',
      from: iso(15),
      to: iso(15),
      days: 1,
      mode: MODES.Full,
      reason: 'Festival at home with family',
      requestedOn: todayISO(),
      status: 'Pending',
    }
    render(
      <LeaveRequestForm
        leaveTypes={optionalLeaveTypes}
        balances={balances}
        optionalHolidays={optionalHolidays}
        mine={[]}
        optionalAllowance={3}
        updateMine={vi.fn(async () => true)}
        editRequest={unconfigured}
        onSubmitted={vi.fn()}
        onCancel={vi.fn()}
        onError={vi.fn()}
      />
    )
    await user.type(screen.getByLabelText(/Reason/), 'Festival at home with family')
    await user.click(screen.getByRole('button', { name: 'Save Changes' }))

    expect(screen.getByText('This date is not a configured optional holiday. Pick one from the calendar.')).toBeInTheDocument()
  })

  it('reports the exhausted allowance for the picked year', async () => {
    const user = userEvent.setup()
    setupOptional({
      mine: [
        { id: 'LV-1', type: 'Optional Holiday', from: iso(10), to: iso(10), days: 1, mode: MODES.Full, reason: 'a', requestedOn: todayISO(), status: 'Approved' },
        { id: 'LV-2', type: 'Optional Holiday', from: iso(11), to: iso(11), days: 1, mode: MODES.Full, reason: 'b', requestedOn: todayISO(), status: 'Approved' },
        { id: 'LV-3', type: 'Optional Holiday', from: iso(12), to: iso(12), days: 1, mode: MODES.Full, reason: 'c', requestedOn: todayISO(), status: 'Pending' },
      ],
    })
    await user.click(screen.getByRole('button', { name: 'Optional Holiday' }))
    expect(screen.getByText(/Remaining: 0 out of 3 Optional Holidays/)).toBeInTheDocument()
    // The calendar still renders (configured dates enabled) but validation
    // refuses a fourth request when a date is picked and submitted.
    await user.type(screen.getByLabelText(/Reason/), 'Festival at home with family')
    await user.click(screen.getByRole('button', { name: 'Submit Request' }))
    expect(screen.getByText(/Pick a from date\./)).toBeInTheDocument()
  })

  it('stays submittable when the ledger is overdrawn but the type is optional', async () => {
    const user = userEvent.setup()
    setupOptional({
      balances: { totalCredited: 5, utilized: 8, rows: [{ key: 'available', label: 'Available', value: 0, max: 18 }] },
    })
    await user.click(screen.getByRole('button', { name: 'Optional Holiday' }))
    expect(screen.getByRole('button', { name: 'Submit Request' })).toBeEnabled()
  })
})
