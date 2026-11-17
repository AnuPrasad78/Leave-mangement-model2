import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { useState } from 'react'
import { Chip } from './Chip'

const meta: Meta<typeof Chip> = {
  title: 'UI/Atoms/Chip',
  component: Chip,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof Chip>

export const Off: Story = {
  args: { children: 'Approved', onClick: fn() },
}

export const On: Story = {
  args: { isOn: true, children: 'Approved', onClick: fn() },
}

/* Interactive demo showing the pressed state flip consumers wire up. */
export const Toggleable: Story = {
  args: { onClick: fn() },
  render: function ToggleableChip(args) {
    const [on, setOn] = useState(false)
    return (
      <Chip
        {...args}
        isOn={on}
        onClick={() => {
          args.onClick?.()
          setOn((prev) => !prev)
        }}
      >
        {on ? 'On' : 'Off'}
      </Chip>
    )
  },
}
