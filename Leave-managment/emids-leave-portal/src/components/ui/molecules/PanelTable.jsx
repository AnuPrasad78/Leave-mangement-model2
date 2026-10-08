export function PanelTable({ title, count, headExtra, columns, rows, rowKey, rowClass, empty, emptyBlock }) {
  return (
    <div className='card'>
      <div className='hl-panel-head'>
        <h3>{title}</h3>
        {(headExtra || count) && (
          <div className='hl-panel-head__right'>
            {headExtra}
            {count && <span className='hl-count'>{count}</span>}
          </div>
        )}
      </div>
      {rows.length === 0 && emptyBlock ? (
        emptyBlock
      ) : (
        <div className='table-scroll'>
          <table className='table'>
            <thead>
              <tr>
                {columns.map((col) => (
                  <th key={col.label} style={col.width != null ? { width: col.width } : undefined}>
                    {col.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.length === 0 && (
                <tr>
                  <td colSpan={columns.length} className='table__empty'>
                    {empty}
                  </td>
                </tr>
              )}
              {rows.map((row) => (
                <tr key={rowKey(row)} className={rowClass?.(row)}>
                  {columns.map((col) => (
                    <td key={col.label} className={col.cellClass} style={col.maxWidth != null ? { maxWidth: col.maxWidth } : undefined}>
                      {col.cell(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
