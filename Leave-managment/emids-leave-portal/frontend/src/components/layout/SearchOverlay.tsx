import { useEffect, useMemo, useRef, useState } from 'react'
import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import { IconButton } from '../ui'
import { useDismiss } from '../../hooks/useDismiss'
import { buildSearchIndex, filterHits } from '../../features/search/searchEverything'
import type { SearchHit, SearchSection } from '../../features/search/searchEverything'
import {
  IconSearch, IconFileText, IconClipboardCheck, IconX,
} from '../Icons'
import type { IconComponent } from '../Icons'
import type { EmployeeProfileRow, LeaveRequestRow, TeamRequestRow } from '../../types/models'

const SECTION_ORDER: SearchSection[] = ['Pages', 'My requests', 'Team requests']

const SECTION_ICONS: Record<SearchSection, IconComponent> = {
  Pages: IconSearch,
  'My requests': IconFileText,
  'Team requests': IconClipboardCheck,
}

export interface SearchOverlayProps {
  /** Role-filtered drawer nav — search never offers dead links. */
  nav: {
    to: string
    num: string
    label: string
    icon: IconComponent
  }[]
  profile: EmployeeProfileRow | null
  mine: LeaveRequestRow[]
  team: TeamRequestRow[]
  onNavigate: (to: string) => void
  onDismiss: () => void
}

export default function SearchOverlay({ nav, profile, mine, team, onNavigate, onDismiss }: SearchOverlayProps) {
  const ref = useRef<HTMLDivElement | null>(null)
  useDismiss(ref, { onClose: onDismiss })

  const inputRef = useRef<HTMLInputElement | null>(null)
  useEffect(() => { inputRef.current?.focus() }, [])

  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)

  const index = useMemo(() => buildSearchIndex(nav, profile?.system_role, mine, team), [nav, profile, mine, team])
  const hits = useMemo(() => filterHits(index, query), [index, query])

  const queryTrimmed = query.trim().length > 0
  const cursor = hits.length ? Math.min(active, hits.length - 1) : 0

  // Query changes reset the keyboard cursor.
  useEffect(() => { setActive(0) }, [query])

  const select = (hit: SearchHit | undefined) => {
    if (!hit) return
    onNavigate(hit.to)
  }

  const onKeyDown = (e: ReactKeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (hits.length) setActive((cursor + 1) % hits.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (hits.length) setActive((cursor - 1 + hits.length) % hits.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      select(hits[cursor])
    }
  }
  // Bound to the input — the only tab stop inside the dialog — so keyboard
  // events never originate from the non-interactive dialog shell itself.

  // Flat cursor order = filtered-hit order; grouped render looks the index up.
  const cursors = useMemo(() => new Map(hits.map((h, i) => [h.key, i])), [hits])

  const groups = SECTION_ORDER
    .map((section) => ({ section, hits: hits.filter((h) => h.section === section) }))
    .filter((g) => g.hits.length > 0)

  return (
    <>
      <div className="pop-backdrop" aria-hidden="true" />
      <div className="search-pop" role="dialog" aria-label="Search" ref={ref}>
        <div className="search-pop__bar">
          <IconSearch size={17} />
          <input
            ref={inputRef}
            type="text"
            className="search-pop__input"
            placeholder="Search pages, requests, teammates…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={onKeyDown}
            aria-label="Search portal"
          />
          <IconButton label="Close search" onClick={onDismiss}>
            <IconX size={15} />
          </IconButton>
        </div>

        <div className="search-pop__results">
          {!queryTrimmed && (
            <div className="search-pop__empty">
              Start typing — pages, requests and teammates will appear here.
            </div>
          )}
          {groups.map((g) => (
            <div className="search-pop__group" key={g.section}>
              <div className="search-pop__heading eyebrow">{g.section}</div>
              {g.hits.map((hit) => {
                const idx = cursors.get(hit.key) ?? -1
                const Icon = SECTION_ICONS[hit.section]
                return (
                  <button
                    key={hit.key}
                    type="button"
                    className={`search-hit${idx === cursor ? ' is-active' : ''}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => select(hit)}
                  >
                    <Icon size={16} />
                    <span className="search-hit__title">{hit.title}</span>
                    <span className="search-hit__meta" title={hit.meta}>{hit.meta}</span>
                  </button>
                )
              })}
            </div>
          ))}

          {queryTrimmed && hits.length === 0 && (
            <div className="search-pop__empty">
              No matches for “{query.trim()}”. Try fewer words — like “annual”, “LV-2026” or an employee name.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
