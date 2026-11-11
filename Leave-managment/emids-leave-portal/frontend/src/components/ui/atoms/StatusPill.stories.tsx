import type { Meta, StoryObj } from '@storybook/react'
import { StatusPill } from './StatusPill'

const meta = {
  title: 'UI/Atoms/StatusPill',
  component: StatusPill,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof StatusPill>

export default meta
type Story = StoryObj<typeof meta>

export const Approved: Story = { args: { status: 'Approved' } }
export const Pending: Story = { args: { status: 'Pending' } }
export const Rejected: Story = { args: { status: 'Rejected' } }
export const Cancelled: Story = { args: { status: 'Cancelled' } }

export const AllKinds: Story = {
  render: () => (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      <StatusPill status='Approved' />
      <StatusPill status='Pending' />
      <StatusPill status='Rejected' />
      <StatusPill status='Cancelled' />
    </div>
  ),
}
