import type { Key, ReactNode } from 'react'
import { Button, PanelTable } from '../../ui'
import type { EmployeeAdminRow } from '../../../types/models'
import { proportionalAnnual } from '../../../features/admin/proportionalAnnual'

export interface EmployeeTableProps {
  rows: readonly EmployeeAdminRow[]
  rowKey: (row: EmployeeAdminRow) => Key
  onEdit: (row: EmployeeAdminRow) => void
  onToggleActive: (row: EmployeeAdminRow) => void
  onResetPassword: (row: EmployeeAdminRow) => void
  empty?: ReactNode
}

const roleLabel: Record<string, string> = {
  employee: 'Employee',
  manager: 'Manager',
  admin: 'Admin',
}

export function EmployeeTable({ rows, rowKey, onEdit, onToggleActive, onResetPassword, empty }: EmployeeTableProps) {
  return (
    <PanelTable
      title="Employees"
      count={String(rows.length)}
      columns={[
        {
          label: 'Name',
          cell: (row) => (
            <div>
              <b>{row.full_name}</b>
              <div className="muted">{row.email}</div>
            </div>
          ),
        },
        { label: 'Emp No', cell: (row) => row.emp_no },
        { label: 'Role', cell: (row) => roleLabel[row.system_role] ?? row.system_role },
        {
          label: 'Joined',
          cell: (row) =>
            row.doj
              ? `${row.doj} · est. ${proportionalAnnual(row.doj, new Date().getFullYear())} d`
              : '—',
        },
        {
          label: 'Status',
          cell: (row) => (row.is_active ? 'Active' : 'Inactive'),
        },
        {
          label: 'Actions',
          cell: (row) => (
            <div className="admin-row-actions">
              <Button variant="ghost" size="sm" onClick={() => onEdit(row)}>
                Edit
              </Button>
              <Button variant="ghost" size="sm" onClick={() => onToggleActive(row)}>
                {row.is_active ? 'Deactivate' : 'Activate'}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => onResetPassword(row)}
                disabled={!row.user_id}
              >
                Reset password
              </Button>
            </div>
          ),
        },
      ]}
      rows={rows}
      rowKey={rowKey}
      empty={empty ?? 'No employees match this search.'}
    />
  )
}
