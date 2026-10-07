import { useEffect, useRef } from 'react'
import { IconButton } from '../ui'
import { IconX, IconSparkles } from '../Icons'

const CHAT_OPTIONS = [
  'How do I apply for leave?',
  'Why does my balance differ?',
  'Cancel a submitted request',
  'Who approves contingency leave?',
]

export default function ChatPanel({ profile, onDismiss }) {
  const ref = useRef(null)
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div className='chatpanel' role='dialog' aria-label='AI assistant' ref={ref}>
      <div className='chatpanel__head'>
        <b>Leave assistant</b>
        <span className='mono'>BETA</span>
        <IconButton label='Close assistant' onClick={onDismiss}>
          <IconX size={17} />
        </IconButton>
      </div>
      <div className='chatpanel__msg'>
        Hi {profile?.full_name?.split(' ')[0] ?? 'there'} — tell me what you need. Pick a topic below.
      </div>
      <div className='chatpanel__opts'>
        {CHAT_OPTIONS.map((o) => (
          <button key={o} className='chatpanel__opt'>{o}</button>
        ))}
      </div>
      <div className='chatpanel__hint mono'>DEMO · RESPONSES DISABLED</div>
    </div>
  )
}

export { IconSparkles, CHAT_OPTIONS }
