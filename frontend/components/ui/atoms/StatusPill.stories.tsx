import type { Meta, StoryObj } from '@storybook/react'
import { StatusPill } from './StatusPill'

const meta: Meta<typeof StatusPill> = {
  title: 'UI/Atoms/StatusPill',
  component: StatusPill,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof StatusPill>

export const Approved: Story = {
  args: { status: 'Approved' },
}

export const Pending: Story = {
  args: { status: 'Pending' },
}

export const Rejected: Story = {
  args: { status: 'Rejected' },
}

export const Cancelled: Story = {
  args: { status: 'Cancelled' },
}

export const AllStatuses: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <StatusPill status='Pending' />
      <StatusPill status='Approved' />
      <StatusPill status='Rejected' />
      <StatusPill status='Cancelled' />
      {/* Unknown statuses fall through to the cancelled style by contract. */}
      <StatusPill status='SomethingElse' />
    </div>
  ),
}
