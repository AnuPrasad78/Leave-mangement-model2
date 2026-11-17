import type { Meta, StoryObj } from '@storybook/react'
import { PanelTable } from './PanelTable'
import { StatusPill } from '../atoms/StatusPill'

interface DemoRow {
  id: number
  employee: string
  type: string
  days: number
  status: string
}

const rows: DemoRow[] = [
  { id: 1, employee: 'Anika Rao', type: 'Annual leave', days: 2, status: 'Pending' },
  { id: 2, employee: 'Dev Malhotra', type: 'Sick leave', days: 1, status: 'Approved' },
  { id: 3, employee: 'Farah Khan', type: 'Optional holiday', days: 1, status: 'Rejected' },
  { id: 4, employee: 'Rahul Nair', type: 'Annual leave', days: 5, status: 'Cancelled' },
]

const meta = {
  title: 'UI/Molecules/PanelTable',
  component: PanelTable,
  parameters: { layout: 'padded' },
} satisfies Meta<typeof PanelTable<DemoRow>>

export default meta
type Story = StoryObj<typeof meta>

export const WithRows: Story = {
  args: {
    title: 'Pending requests',
    count: `${rows.length} row${rows.length === 1 ? '' : 's'}`,
    columns: [
      { label: 'Employee', cell: (row: DemoRow) => row.employee, cellClass: 'mono' },
      { label: 'Type', cell: (row: DemoRow) => row.type },
      { label: 'Days', cell: (row: DemoRow) => row.days, width: 60 },
      { label: 'Status', cell: (row: DemoRow) => <StatusPill status={row.status} />, width: 110 },
    ],
    rows,
    rowKey: (row: DemoRow) => row.id,
    empty: 'No requests yet',
  },
}

export const Empty: Story = {
  args: {
    title: 'Pending requests',
    columns: [
      { label: 'Employee', cell: (row: DemoRow) => row.employee },
      { label: 'Type', cell: (row: DemoRow) => row.type },
    ],
    rows: [],
    rowKey: (row: DemoRow) => row.id,
    empty: 'No pending requests',
  },
}
