import type { Meta, StoryObj } from '@storybook/react'
import { EmployeeTable } from './EmployeeTable'
import type { EmployeeAdminRow } from '../../../types/models'

const employee = (overrides: Partial<EmployeeAdminRow> = {}): EmployeeAdminRow =>
  ({
    id: 'e-1', user_id: 'u-1', emp_no: 'EM-20810', full_name: 'Sai Nithin Reddy',
    initials: 'SN', email: 'sai.nithinreddy@emids.com', job_title: 'Consultant',
    doj: '2026-03-01', account: 'Delta', project_name: 'ClaimX', function_name: 'Engineering',
    manager_id: null, delivery_partner_name: null, location: 'Bangalore',
    system_role: 'employee', is_active: true, created_at: '2026-03-01T00:00:00Z',
    ...overrides,
  }) as EmployeeAdminRow

const rows: EmployeeAdminRow[] = [
  employee(),
  employee({ id: 'e-2', user_id: 'u-2', emp_no: 'EM-20832', full_name: 'Rahul Iyer', initials: 'RI', email: 'rahul.iyer@emids.com', system_role: 'manager' }),
  employee({ id: 'e-3', user_id: 'u-3', emp_no: 'EM-20798', full_name: 'Prastina Dash', initials: 'PD', email: 'prastina.dash@emids.com', system_role: 'admin' }),
  employee({ id: 'e-4', user_id: 'u-4', emp_no: 'EM-20901', full_name: 'Anu Prasad', initials: 'AP', email: 'anu.prasad@emids.com', is_active: false }),
]

const meta = {
  title: 'Features/Admin/EmployeeTable',
  component: EmployeeTable,
  argTypes: {
    onEdit: { action: 'edit clicked' },
    onToggleActive: { action: 'toggle active' },
    onResetPassword: { action: 'reset password' },
  },
} satisfies Meta<typeof EmployeeTable>

export default meta
type Story = StoryObj<typeof meta>

export const FourEmployees: Story = {
  args: { rows, rowKey: (row) => row.id, onEdit: () => {}, onToggleActive: () => {}, onResetPassword: () => {} },
}

export const Empty: Story = {
  args: { rows: [], rowKey: (row) => row.id, onEdit: () => {}, onToggleActive: () => {}, onResetPassword: () => {}, empty: 'No employees match the filters.' },
}
