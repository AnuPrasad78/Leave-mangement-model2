import { render, screen } from '@testing-library/react'
import { PanelTable } from '../../../../src/components/ui'

const columns = [
  { label: 'Ref', cell: (r) => r.id, cellClass: 'req-id' },
  { label: 'From', cell: (r) => r.from, cellClass: 'nowrap' },
  { label: 'Reason', cell: (r) => r.reason, maxWidth: 260 },
]

describe('ui/PanelTable', () => {
  it('renders the pinned card + panel head scaffold', () => {
    render(
      <PanelTable title='Request History' count='2 ENTRIES · LV-FY2026' columns={columns} rows={[{ id: 'LV-1', from: '2 Mar', reason: 'Trip' }]} rowKey={(r) => r.id} empty='No requests.' />
    )
    expect(document.querySelector('.card')).not.toBeNull()
    expect(screen.getByText('Request History').tagName).toBe('H3')
    expect(screen.getByText('2 ENTRIES · LV-FY2026')).toHaveClass('hl-count')
    const table = document.querySelector('table.table')
    expect(table).not.toBeNull()
    expect(table.closest('.table-scroll')).not.toBeNull()
  })

  it('renders head-actions before the count (approve-all cluster)', () => {
    render(
      <PanelTable
        title='Team Requests'
        count='3 ENTRIES'
        headExtra={<button>APPROVE ALL (3)</button>}
        columns={columns}
        rows={[{ id: 'LV-1', from: 'x', reason: 'y' }]}
        rowKey={(r) => r.id}
      />
    )
    const right = document.querySelector('.hl-panel-head__right')
    expect(right.firstElementChild.tagName).toBe('BUTTON')
    expect(right.lastElementChild).toHaveClass('hl-count')
  })

  it('renders th width styles and td cell classes / maxWidth', () => {
    render(
      <PanelTable
        title='T'
        columns={[{ label: 'Pick', cell: () => 'x', width: 44 }, ...columns]}
        rows={[{ id: 'LV-1', from: 'd', reason: 'r' }]}
        rowKey={(r) => r.id}
      />
    )
    expect(screen.getByText('Pick')).toHaveStyle({ width: '44px' })
    expect(screen.getByText('LV-1').closest('td')).toHaveClass('req-id')
    expect(screen.getByText('r').closest('td')).toHaveStyle({ maxWidth: '260px' })
  })

  it('renders the empty row with colSpan when rows are empty', () => {
    render(<PanelTable title='T' columns={columns} rows={[]} rowKey={() => 'x'} empty='No pending requests right now.' />)
    const cell = screen.getByText('No pending requests right now.')
    expect(cell.tagName).toBe('TD')
    expect(cell).toHaveClass('table__empty')
    expect(cell).toHaveAttribute('colspan', '3')
    expect(document.querySelector('table.table')).not.toBeNull()
  })

  it('omits the table entirely for the leave-details block empty state', () => {
    render(
      <PanelTable
        title='Request History'
        columns={columns}
        rows={[]}
        rowKey={(r) => r.id}
        emptyBlock={<div className='table__empty'>No requests on file.</div>}
      />
    )
    expect(document.querySelector('table')).toBeNull()
    expect(screen.getByText('No requests on file.').closest('.card')).not.toBeNull()
  })
})
