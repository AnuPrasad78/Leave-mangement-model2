import { vi } from 'vitest'

// Shared next/navigation mock for the unit suites: components run their real
// code and navigation shows up as push/replace spy calls. The rendered-outcome
// contract (the right page ends up at the right URL) stays covered by e2e.
const push = vi.fn()
const replace = vi.fn()

const pushTargets = (): string[] => push.mock.calls.map((c) => c[0] as string)
const replaceTargets = (): string[] => replace.mock.calls.map((c) => c[0] as string)

const expectPush = (to: string) => {
  if (!pushTargets().includes(to)) {
    throw new Error(`expected push to '${to}', got ${JSON.stringify(pushTargets())}`)
  }
}
const expectReplace = (to: string) => {
  if (!replaceTargets().includes(to)) {
    throw new Error(`expected replace to '${to}', got ${JSON.stringify(replaceTargets())}`)
  }
}

// vi.mock('next/navigation', () => navMocks()) — factory + asserted helpers on
// one object so the use-site assertions and the module mock cannot drift.
export const navMocks = Object.assign(
  () => ({ useRouter: () => ({ push, replace, refresh: vi.fn() }), usePathname: () => '/dashboard' }),
  {
    push,
    replace,
    pushTargets,
    replaceTargets,
    expectPush,
    expectReplace,
    clear: () => {
      push.mockClear()
      replace.mockClear()
    },
  },
)

type NavMocks = typeof navMocks
export default navMocks as NavMocks
