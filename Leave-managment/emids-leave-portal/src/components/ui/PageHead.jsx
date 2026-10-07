export function PageHead({ eyebrow, title, accent, children }) {
  return (
    <header className='page-head'>
      <span className='eyebrow' style={accent ? { color: 'var(--red-deep)' } : undefined}>
        {eyebrow}
      </span>
      <h1>{title}</h1>
      {children}
    </header>
  )
}
