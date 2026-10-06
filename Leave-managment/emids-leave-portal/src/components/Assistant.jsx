import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../store/AuthContext'
import { answer } from '../lib/assistant'
import { IconX } from './Icons'

const SUGGESTIONS = ['My balance', 'Upcoming leave', 'Team pending', 'How do I apply']

function IconChat({ size = 20 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  )
}

export default function Assistant() {
  const { profile, balances, mine, team } = useAuth()
  const [open, setOpen] = useState(false)
  const [log, setLog] = useState([])
  const [value, setValue] = useState('')
  const logRef = useRef(null)
  const navigate = useNavigate()

  useEffect(() => {
    const el = logRef.current
    if (el) el.scrollTo({ top: el.scrollHeight })
  }, [log, open])

  useEffect(() => {
    if (!open) return
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  const send = (text) => {
    const query = (text ?? value).trim()
    if (!query) return
    const reply = answer(query, { balances, mine, team, today: new Date(), systemRole: profile?.system_role })
    setLog((l) => [...l, { from: 'you', text: query }, { from: 'bot', text: reply.text, actions: reply.actions }])
    setValue('')
  }

  return (
    <>
      <button
        className="bot-btn"
        aria-label="Leave assistant"
        title="Leave assistant"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
      >
        <IconChat size={22} />
      </button>

      {open && (
        <div className="assistant brand-frame">
          <div className="assistant__bar" />
          <div className="assistant__head">
            <span className="eyebrow">↘ Leave Assistant</span>
            <button className="icon-btn" aria-label="Close assistant" onClick={() => setOpen(false)}>
              <IconX size={17} />
            </button>
          </div>

          <div className="assistant__log" ref={logRef}>
            {log.length === 0 && (
              <div className="assistant__start">
                Ask about balances, your upcoming leave or your team queue — the numbers come straight
                from the portal.
              </div>
            )}
            {log.map((m, i) => (
              <div key={i} className={`msg ${m.from === 'you' ? 'msg--you' : 'msg--bot'}`}>
                <span className="msg__who">{m.from === 'you' ? 'YOU' : 'ASSISTANT'}</span>
                <p>{m.text}</p>
                {m.actions?.map((a) => (
                  <button key={a.to} className="chip" onClick={() => { navigate(a.to); setOpen(false) }}>
                    {a.label}
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div className="assistant__chips">
            {SUGGESTIONS.map((s) => (
              <button key={s} className="chip" onClick={() => send(s)}>{s}</button>
            ))}
          </div>

          <form
            className="assistant__entry"
            onSubmit={(e) => { e.preventDefault(); send() }}
          >
            <input
              className="input"
              placeholder="Ask about your leave…"
              value={value}
              onChange={(e) => setValue(e.target.value)}
              aria-label="Ask the leave assistant"
            />
            <button className="btn btn--primary assistant__send" type="submit" disabled={!value.trim()}>
              SEND
            </button>
          </form>
        </div>
      )}
    </>
  )
}
