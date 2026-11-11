import type { Meta, StoryObj } from '@storybook/react'
import { Donut } from './Donut'

const meta = {
  title: 'UI/Atoms/Donut',
  component: Donut,
  tags: ['autodocs'],
  argTypes: {
    used: { control: 'number', min: 0 },
    total: { control: 'number', min: 0 },
    size: { control: 'number', min: 80 },
  },
} satisfies Meta<typeof Donut>

export default meta
type Story = StoryObj<typeof meta>

export const QuarterUsed: Story = {
  args: { used: 4, total: 18, label: 'of 18 days used' },
}

export const MostlyUsed: Story = {
  args: { used: 15, total: 18, label: 'of 18 days used' },
}

export const Empty: Story = {
  args: { used: 0, total: 18, label: 'nothing used yet' },
}

export const Overdrawn: Story = {
  // > 100% just clamps visually via the fraction — same as the app.
  args: { used: 23, total: 18, label: 'overdrawn' },
}

export const SmallSize: Story = {
  args: { used: 4, total: 10, size: 120, label: 'contingency 6/10 left' },
}
