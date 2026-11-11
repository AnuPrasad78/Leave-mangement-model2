import type { Meta, StoryObj } from '@storybook/react'
import { ConfirmModal } from './ConfirmModal'

const meta = {
  title: 'UI/Molecules/ConfirmModal',
  component: ConfirmModal,
  tags: ['autodocs'],
  argTypes: {
    onConfirm: { action: 'confirm clicked' },
    onClose: { action: 'dismissed (backdrop / Esc / X)' },
  },
  parameters: { layout: 'centered' },
} satisfies Meta<typeof ConfirmModal>

export default meta
type Story = StoryObj<typeof meta>

export const Separation: Story = {
  args: {
    title: 'Raise separation request?',
    text: 'HR and your manager both get notified. You can withdraw it while it is still pending.',
    confirmLabel: 'Confirm & notify HR',
  },
}

export const DeactivateDanger: Story = {
  args: {
    title: 'Deactivate Prashant Kumar?',
    text: 'Login access is revoked immediately; the profile stays in the directory.',
    confirmLabel: 'Deactivate',
    danger: true,
  },
}

export const Busy: Story = {
  args: {
    title: 'Raise separation request?',
    text: 'HR and your manager both get notified.',
    confirmLabel: 'Confirm & notify HR',
    busy: true,
  },
}
