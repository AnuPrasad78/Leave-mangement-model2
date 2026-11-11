import type { Meta, StoryObj } from '@storybook/react'
import { Chip } from './Chip'

const meta = {
  title: 'UI/Atoms/Chip',
  component: Chip,
  tags: ['autodocs'],
} satisfies Meta<typeof Chip>

export default meta
type Story = StoryObj<typeof meta>

export const Off: Story = {
  args: { children: 'Paid Time Off' },
}

export const On: Story = {
  args: { isOn: true, children: 'Paid Time Off' },
}

/** How the leave-type picker composes them. */
export const ChipGroup: Story = {
  render: () => (
    <div className='chipbox'>
      <Chip isOn>Optional Holiday</Chip>
      <Chip>Work From Home</Chip>
      <Chip>Business Travel</Chip>
    </div>
  ),
}
