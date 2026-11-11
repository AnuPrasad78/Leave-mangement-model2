import type { Meta, StoryObj } from '@storybook/react'
import { AuditLogTable } from './AuditLogTable'
import type { AuditLogRow } from '../../../types/models'

const log = (overrides: Partial<AuditLogRow> = {}): AuditLogRow =>
  ({
    id: 1, action: 'employee_created', target_type: 'employee', target_id: 'e-2',
    actor_employee_id: 'a-1', request_ip: '127.0.0.1',
    detail_json: { email: 'rahul.iyer@emids.com', system_role: 'manager' },
    created_at: '2026-11-03T09:12:44Z',
    ...overrides,
  }) as AuditLogRow

const rows: AuditLogRow[] = [
  log(),
  log({ id: 2, action: 'nudge_sent', target_type: 'notification', target_id: null, detail_json: { title: 'Decision pending on LV-2026-00021', recipient_count: 2 }, created_at: '2026-11-04T11:02:13Z' }),
  log({ id: 3, action: 'balance_upserted', target_type: 'leave_balance', target_id: 'e-1:2026', detail_json: { opening_annual: 3, annual_credited: 15 } }),
  log({ id: 4, action: 'carry_forward', target_type: 'leave_balance', target_id: '2026', detail_json: null }),
]

const meta = {
  title: 'Features/Admin/AuditLogTable',
  component: AuditLogTable,
} satisfies Meta<typeof AuditLogTable>

export default meta
type Story = StoryObj<typeof meta>

export const FourEntries: Story = {
  args: { rows, rowKey: (row) => row.id },
}

export const Empty: Story = {
  args: { rows: [], rowKey: (row) => row.id, empty: 'Nothing audited yet — mutative admin actions show up here.' },
}
