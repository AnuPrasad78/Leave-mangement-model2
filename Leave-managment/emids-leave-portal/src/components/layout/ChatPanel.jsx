import { useRef } from 'react'
import { IconButton } from '../ui'
import { IconX } from '../Icons'
import { useDismiss } from '../../hooks/useDismiss'

const CHAT_OPTIONS = [
  'How do I apply for leave?',
  'Why does my balance differ?',
  'Cancel a submitted request',
  'Who approves contingency leave?',
]

export default function ChatPanel({ profile, onDismiss }) {
  const ref = useRef(null)
  // Escape-only dismissal — outside mousedown is intentionally left off so the
  // FAB overlay behaves like the drawer dialog, not the profile popover.
  useDismiss(ref, { onClose: onDismiss, outside: false })

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
