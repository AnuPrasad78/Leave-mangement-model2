'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'

export interface NavLinkProps {
  to: string
  className?: string
  children: ReactNode
  [rest: string]: unknown
}

/* Active-state link for internal navigation: appends the historically
 * `active` class (string parity with the React Router v6 app it replaces —
 * do NOT switch to the unused `.nav-item.is-active` rule) and sets
 * aria-current="page" on exact or nested <to>/… matches. */
export function NavLink({ to, className, children, ...rest }: NavLinkProps) {
  // usePathname is typed nullable during prerender; '' simply never matches.
  const pathname = usePathname() ?? ''
  const isActive = pathname === to || pathname.startsWith(`${to}/`)
  const fullClassName = `${className ?? ''}${isActive ? ' active' : ''}`
  return (
    <Link
      href={to}
      className={fullClassName}
      aria-current={isActive ? 'page' : undefined}
      {...rest}
    >
      {children}
    </Link>
  )
}
