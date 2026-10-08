import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { todayISO } from '../../../../../src/utils/dates'
import { MODES } from '../../../../../src/constants'
import LeaveRequestForm from '../../../../../src/components/feature/leave-request-form/LeaveRequestForm'

const leaveTypes = ['Paid Time Off', 'Work From Home']
const balances = {
  totalCredited: 20,
  utilized: 5,
  rows: [{ key: 'available', value: 15, max: 18 }],
}

function setup({ addMine = vi.fn(async () => 'LV-100'), balances: b = balances } = {}) {
  const onSubmitted = vi.fn()
  const onCancel = vi.fn()
  render(
    <LeaveRequestForm
      leaveTypes={leaveTypes}
      balances={b}
      addMine={addMine}
      onSubmitted={onSubmitted}
      onCancel={onCancel}
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
    expect(screen.getByText('Pick a from date.')).toBeInTheDocument()
    expect(screen.getByText('Pick a to date.')).toBeInTheDocument()
    expect(screen.getByText('Tell the approver why, in a line or two.')).toBeInTheDocument()
  })

  it('disables submit when the stored balance is overdrawn', () => {
    const addMine = vi.fn(async () => 'LV-x')
    setup({ addMine, balances: { totalCredited: 12, utilized: 14, rows: [{ key: 'available', value: 0, max: 18 }] } })
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
})
