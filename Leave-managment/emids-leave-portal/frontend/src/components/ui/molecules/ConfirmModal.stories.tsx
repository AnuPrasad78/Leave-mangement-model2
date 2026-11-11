import type { Meta, StoryObj } from '@storybook/react'
import { ConfirmModal } from './ConfirmModal'

const meta: Meta<typeof ConfirmModal> = {
  title: 'UI/Molecules/ConfirmModal',
  component: ConfirmModal,
  tags: ['autodocs'],
  argTypes: {
    onConfirm: { action: 'confirm clicked' },
    onClose: { action: 'dismissed (backdrop / Esc / X)' },
  },
}

export default meta
type Story = StoryObj

export const Separation: Story = {
  render: () => (
    <ConfirmModal
      title='Raise separation request?'
      text='HR and your manager both get notified. You can withdraw it while it is still pending.'
      confirmLabel='Confirm & notify HR'
      onConfirm={() => undefined}
      onClose={() => undefined}
    />
  ),
}

export const DeactivateDanger: Story = {
  render: () => (
    <ConfirmModal
      title='Deactivate Prashant Kumar?'
      text='Login access is revoked immediately; the profile stays in the directory.'
      confirmLabel='Deactivate'
      danger
      onConfirm={() => undefined}
      onClose={() => undefined}
    />
  ),
}

export const Busy: Story = {
  render: () => (
    <ConfirmModal
      title='Raise separation request?'
      text='HR and your manager both get notified.'
      confirmLabel='Confirm & notify HR'
      busy
      onConfirm={() => undefined}
      onClose={() => undefined}
    />
  ),
}
