import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { useState } from 'react'
import { SegmentedControl } from './SegmentedControl'

const meta = {
  title: 'UI/Atoms/SegmentedControl',
  component: SegmentedControl,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof SegmentedControl<'Pending' | 'Approved' | 'Rejected'>>

export default meta
type Story = StoryObj<typeof meta>

export const StatusFilter: Story = {
  args: {
    ariaLabel: 'Filter by status',
    options: ['Pending', 'Approved', 'Rejected'],
    value: 'Pending',
    onChange: fn(),
  },
}

/* Interactive demo — the parent owns the state in the app. */
export const Interactive: Story = {
  args: {
    ariaLabel: 'Filter by status',
    options: ['Pending', 'Approved', 'Rejected'],
    value: 'Pending',
    onChange: fn(),
  },
  render: function InteractiveControl(args) {
    const [value, setValue] = useState(args.value)
    return (
      <SegmentedControl
        ariaLabel={args.ariaLabel}
        options={args.options}
        value={value}
        onChange={(next) => {
          args.onChange?.(next)
          setValue(next)
        }}
      />
    )
  },
}
