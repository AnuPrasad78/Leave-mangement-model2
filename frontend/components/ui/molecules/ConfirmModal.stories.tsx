import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { useState } from 'react'
import { ConfirmModal } from './ConfirmModal'

const meta: Meta<typeof ConfirmModal> = {
  title: 'UI/Molecules/ConfirmModal',
  component: ConfirmModal,
  // Backdrop fills the canvas; the dialog shadows over plain centre layout.
  parameters: { layout: 'fullscreen' },
}

export default meta
type Story = StoryObj<typeof ConfirmModal>

export const ApproveRequests: Story = {
  args: {
    title: 'Approve requests',
    text: '3 selected requests will be approved. Affected employees are notified on their next dashboard load.',
    confirmLabel: 'Approve',
    onConfirm: fn(),
    onClose: fn(),
  },
}

export const DangerAction: Story = {
  args: {
    title: 'Cancel leave request',
    text: 'This cancels the pending request for 14–15 Nov. A cancellation email is queued for the employee.',
    confirmLabel: 'Cancel request',
    danger: true,
    onConfirm: fn(),
    onClose: fn(),
  },
}

export const WhileBusy: Story = {
  args: {
    title: 'Approve requests',
    text: '3 selected requests will be approved. Affected employees are notified on their next dashboard load.',
    confirmLabel: 'Approve',
    busy: true,
    onConfirm: fn(),
    onClose: fn(),
  },
}

/* Interactive demo — Escape, outside click, and the Close button all dismiss. */
export const Interactive: Story = {
  args: {
    title: 'Approve requests',
    text: '3 selected requests will be approved. Affected employees are notified on their next dashboard load.',
    confirmLabel: 'Approve',
    onConfirm: fn(),
    onClose: fn(),
  },
  render: function InteractiveModal(args) {
    const [open, setOpen] = useState(true)
    return (
      <div>
        <button
          type='button'
          className='btn btn--ghost'
          onClick={() => setOpen(true)}
          disabled={open}
        >
          Open modal
        </button>
        {open && (
          <ConfirmModal
            {...args}
            onClose={() => {
              args.onClose?.()
              setOpen(false)
            }}
          />
        )}
      </div>
    )
  },
}
