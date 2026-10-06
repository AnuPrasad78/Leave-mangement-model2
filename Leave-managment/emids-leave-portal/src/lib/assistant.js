// Pure answer engine for the Leave Assistant. No React, no Supabase, no side
// effects — the REPL seam for a future LLM-backed answer() (same signature).
import { fmtDate } from '../data.js'

const iso = (d) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`

const FALLBACK = "I can help with: balances · my upcoming leave · team pending · who's on leave today · how to apply."

export function answer(query, ctx) {
  const q = (query ?? '').toLowerCase().trim()
  const todayIso = iso(ctx.today)
  const mine = ctx.mine ?? []
  const team = ctx.team ?? []

  if (!q) return { text: 'Ask me about your balance, upcoming leave or team queue.' }

  // my requests → open the history page
  if (/my (requests?|leaves?)/.test(q)) {
    return {
      text: 'Your full request history lives on My Requests.',
      actions: [{ label: 'Open my requests', to: '/leave-details' }],
    }
  }

  if (/balance|how many|left|remaining|available/.test(q)) {
    const b = ctx.balances
    if (!b) return { text: 'Balances are still loading — give me a second.' }
    const available = Math.max(0, b.totalCredited - b.utilized)
    const cont = b.rows?.find((r) => r.key === 'contAvailable')
    return {
      text:
        `You have ${available.toFixed(2)} of ${b.totalCredited.toFixed(2)} annual days left ` +
        `(${b.utilized.toFixed(2)} utilized) this year. Contingency: ${cont ? cont.value.toFixed(2) : '—'} days.`,
    }
  }

  if (/upcoming|next/.test(q)) {
    const next = mine
      .filter((r) => r.status === 'Pending' || r.status === 'Approved')
      .filter((r) => r.to >= todayIso)
      .sort((a, b) => a.from.localeCompare(b.from))[0]
    if (!next) return { text: 'No approved or pending leave ahead of you.' }
    return {
      text: `${next.type} · ${fmtDate(next.from)} → ${fmtDate(next.to)} · ${next.days} day(s) · ${next.status}.`,
    }
  }

  if (/team|pending|approve|queue/.test(q)) {
    if (!team.length) return { text: 'You have no direct reports yet, so the team queue is empty.' }
    const pends = team.filter((r) => r.status === 'Pending')
    if (!pends.length) return { text: 'Your team queue is clear — no pending requests.' }
    const heads = pends.slice(0, 3).map((r) => `${r.name} · ${fmtDate(r.from)}`).join(' · ')
    return {
      text: `${pends.length} pending in your queue: ${heads}${pends.length > 3 ? ' · +more' : ''}.`,
      actions: [{ label: 'Open queue', to: '/leave-requests' }],
    }
  }

  if (/on leave|absent|who is off|who's off|whos off|who is out|who's out|whos out/.test(q)) {
    if (!team.length) return { text: 'You have no direct reports yet.' }
    const off = team.filter((r) => r.status === 'Approved' && r.from <= todayIso && r.to >= todayIso)
    if (!off.length) return { text: 'Nobody on your team is off today.' }
    return { text: `Off today: ${off.map((r) => `${r.name} (${r.type})`).join(' · ')}.` }
  }

  if (/holiday/.test(q)) {
    return {
      text: 'Fixed and optional holidays live in the Holiday Calendar — optional picks are yours to choose.',
      actions: [{ label: 'Open calendar', to: '/holidays' }],
    }
  }

  if (/apply|raise|how do i|book/.test(q)) {
    return {
      text: 'Apply Leave (02 in the nav): pick a type, your dates and a one-line reason — working days credit automatically.',
      actions: [{ label: 'Apply leave', to: '/apply-leave' }],
    }
  }

  return { text: FALLBACK }
}
