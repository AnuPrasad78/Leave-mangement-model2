import { describe, expect, it } from 'vitest'
import { paginate, PAGE_SIZE } from '../../../src/utils/paginate'

describe('utils/paginate', () => {
  const items = Array.from({ length: 13 }, (_, index) => index + 1)

  it('slices the default page size of 10', () => {
    expect(PAGE_SIZE).toBe(10)
    expect(paginate(items, 1)).toEqual({ rows: items.slice(0, 10), page: 1, pageCount: 2, total: 13 })
    expect(paginate(items, 2)).toEqual({ rows: items.slice(10, 13), page: 2, pageCount: 2, total: 13 })
  })

  it('clamps out-of-range pages into the surviving range', () => {
    expect(paginate(items, 99).page).toBe(2)
    expect(paginate(items, 0).page).toBe(1)
    expect(paginate(items, -5).rows).toEqual(paginate(items, 1).rows)
  })

  it('returns an empty view for an empty list', () => {
    expect(paginate([], 1)).toEqual({ rows: [], page: 0, pageCount: 0, total: 0 })
  })

  it('honours a custom page size', () => {
    expect(paginate(items, 3, 5)).toEqual({ rows: [11, 12, 13], page: 3, pageCount: 3, total: 13 })
  })
})
