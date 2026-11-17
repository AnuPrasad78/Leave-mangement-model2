import { createElement, type ReactNode } from 'react'
import type { AnchorHTMLAttributes } from 'react'
import { vi } from 'vitest'

// Shared test double for the Next.js App Router. Spied router + a mutable
// pathname ref; each spec picks its route with `mockPathname.current` and
// asserts navigation with `mockRouter.push/replace` calls.

export const mockRouter = {
  push: vi.fn(),
  replace: vi.fn(),
  back: vi.fn(),
  forward: vi.fn(),
  refresh: vi.fn(),
  prefetch: vi.fn(),
}

export const mockPathname = { current: '/' }

export function mockNextNavigation() {
  return {
    useRouter: () => mockRouter,
    usePathname: () => mockPathname.current,
    useParams: () => ({}),
    useSearchParams: () => new URLSearchParams(),
    useSelectedLayoutSegment: () => null,
    useSelectedLayoutSegments: () => [],
  }
}

// next/link renders an <a> outside of a Next server context anyway; this
// stub keeps the render predictable under jsdom.
export function mockLink(props: { href: string; children: ReactNode } & AnchorHTMLAttributes<HTMLAnchorElement>) {
  const { href, children, ...rest } = props
  return createElement('a', { href, ...rest }, children)
}
