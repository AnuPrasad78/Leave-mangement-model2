import type { Key, ReactNode } from 'react'
import { PanelTable } from '../../ui'
import type { AuditLogRow } from '../../../types/models'

export interface AuditLogTableProps {
  rows: readonly AuditLogRow[]
  rowKey: (row: AuditLogRow) => Key
  empty?: ReactNode
}

function describeDetail(detail: Record<string, unknown> | null): string {
  if (!detail) return '—'
  return Object.entries(detail)
    .map(([key, value]) => `${key}: ${typeof value === 'object' && value !== null ? JSON.stringify(value) : String(value)}`)
    .join(' · ')
}

export function AuditLogTable({ rows, rowKey, empty }: AuditLogTableProps) {
  return (
    <PanelTable
      title="Audit trail"
      count={String(rows.length)}
      columns={[
        { label: 'When', cell: (row) => row.created_at ?? '—' },
        { label: 'Action', cell: (row) => row.action },
        { label: 'Target', cell: (row) => `${row.target_type} ${row.target_id ?? ''}` },
        { label: 'Actor', cell: (row) => row.actor_employee_id ?? '—' },
        { label: 'IP', cell: (row) => row.request_ip ?? '—' },
        {
          label: 'Detail',
          cell: (row) => <span className="admin-log-detail">{describeDetail(row.detail_json)}</span>,
        },
      ]}
      rows={rows}
      rowKey={rowKey}
      empty={empty ?? 'No audit entries match these filters.'}
    />
  )
}
