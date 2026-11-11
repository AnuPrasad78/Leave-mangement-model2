import type { Meta, StoryObj } from '@storybook/react'
import { MemoryRouter } from 'react-router-dom'
import LeaveRequestHistory from './LeaveRequestHistory'
import type { LeaveRequestRow } from '../../../types/models'

// Needs a Router for its inline "Raise one" link; the rendered rows come
// straight from the pages via props, no store is involved.
const rows: LeaveRequestRow[] = [
  { id: 'LV-2026-00021', mode: 'Full Day', type: 'Compensatory Off', from: '2026-11-02', to: '2026-11-03', days: 2, reason: 'Comp for festival weekend', requestedOn: '2026-10-01', status: 'Pending' },
  { id: 'LV-2026-00022', mode: 'Full Day', type: 'Paid Time Off', from: '2026-12-02', to: '2026-12-04', days: 3, reason: 'Winter break with family', requestedOn: '2026-10-02', status: 'Approved' },
  { id: 'LV-2026-00023', mode: 'Full Day', type: 'Work From Home', from: '2026-12-10', to: '2026-12-10', days: 1, reason: 'Home broadband outage', requestedOn: '2026-10-03', status: 'Rejected' },
]

const meta = {
  title: 'Features/LeaveRequestHistory',
  component: LeaveRequestHistory,
  parameters: {
    decorators: [(Story) => <MemoryRouter><Story /></MemoryRouter>],
  },
} satisfies Meta<typeof LeaveRequestHistory>

export default meta
type Story = StoryObj<typeof meta>

export const ThreeRequests: Story = {
  args: { mine: rows, cancelMine: () => {}, onEdit: () => {}, yearLabel: 2026 },
}

export const Empty: Story = {
  args: { mine: [], cancelMine: () => {}, onEdit: () => {}, yearLabel: 2026 },
}
