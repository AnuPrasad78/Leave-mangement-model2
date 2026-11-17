import type { Meta, StoryObj } from '@storybook/react'
import { Donut } from './Donut'

const meta: Meta<typeof Donut> = {
  title: 'UI/Atoms/Donut',
  component: Donut,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof Donut>

export const HalfUsed: Story = {
  args: { used: 6, total: 12, label: 'Annual leave' },
}

export const QuarterUsed: Story = {
  args: { used: 3, total: 12, label: 'Annual leave' },
}

export const FullyUsed: Story = {
  args: { used: 12, total: 12, label: 'Annual leave' },
}

export const NothingUsed: Story = {
  args: { used: 0, total: 12, label: 'Annual leave' },
}

export const SmallSize: Story = {
  args: { used: 2, total: 5, size: 120, label: 'Sick days' },
}

export const DivByZeroSafe: Story = {
  args: { used: 2, total: 0, label: 'No quota set' },
}
