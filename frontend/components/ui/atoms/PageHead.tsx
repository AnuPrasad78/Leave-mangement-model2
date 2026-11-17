import type { ReactNode } from 'react'

export interface PageHeadProps {
  eyebrow: string
  title: string
  accent?: boolean
  children?: ReactNode
}

export function PageHead({ eyebrow, title, accent, children }: PageHeadProps) {
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
