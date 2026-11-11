import type { Meta, StoryObj } from '@storybook/react'
import { PanelTable } from './PanelTable'
import { StatusPill } from '../atoms/StatusPill'
import { fmtDate } from '../../../utils/dates'
import type { TeamRequestRow } from '../../../types/models'

// PanelTable is the generic card/table the admin boards and the queue share.
// The stories pin it to a concrete row type so the columns show real render
// functions, not '?'-typed cells.
type Row = TeamRequestRow

const rows: Row[] = [
  { id: 'LV-2026-00021', name: 'Sai Nithin Reddy', empId: 'EM-20810', absenceType: 'Paid Time Off', type: 'Paid Time Off', from: '2026-11-20', to: '2026-11-22', days: 3, mode: 'Full Day', reason: 'Diwali travel to Hyderabad', requestedOn: '2026-11-01', status: 'Pending' },
  { id: 'LV-2026-00022', name: 'Rahul Iyer', empId: 'EM-20832', absenceType: 'Work From Home', type: 'Work From Home', from: '2026-11-25', to: '2026-11-25', days: 1, mode: 'Full Day', reason: 'Flat maintenance visitor', requestedOn: '2026-11-02', status: 'Approved' },
] as Row[]

const columns = [
  { label: 'Request', cell: (row: Row) => <b>{row.id}</b> },
  { label: 'Employee', cell: (row: Row) => row.name },
  { label: 'Type', cell: (row: Row) => row.absenceType },
  { label: 'Dates', cell: (row: Row) => `${fmtDate(row.from)} – ${fmtDate(row.to)}` },
  { label: 'Status', cell: (row: Row) => <StatusPill status={row.status} /> },
]

const meta = {
  title: 'UI/Molecules/PanelTable',
  component: PanelTable,
  tags: ['autodocs'],
  parameters: {
    // The generic table is typed per usage; keep controls off the columns.
    controls: { disable: true },
  },
} satisfies Meta<typeof PanelTable<Row>>

export default meta

type Story = StoryObj<typeof meta>

export const WithRows: Story = {
  render: (args) => <PanelTable<Row> {...args} rowKey={(row) => row.id} />,
  args: {
    title: 'Team queue',
    count: `${rows.length} listing`,
    columns,
    rows,
  },
}

export const EmptyState: Story = {
  render: (args) => <PanelTable<Row> {...args} rowKey={(row) => row.id} />,
  args: {
    title: 'Team queue',
    count: '0 listing',
    columns,
    rows: [],
    empty: 'Nothing pending — the queue is clear.',
  },
}
