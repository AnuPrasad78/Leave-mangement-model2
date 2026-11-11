import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { SegmentedControl } from './SegmentedControl'
import { MODES } from '../../../constants'

const meta = {
  title: 'UI/Atoms/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
} satisfies Meta<typeof SegmentedControl>

export default meta
type Story = StoryObj<typeof meta>

/** Live toggle — the day-mode selector as used in the leave form. */
export const DayMode: Story = {
  render: () => {
    const [value, setValue] = useState(MODES.Full)
    return (
      <SegmentedControl
        value={value}
        options={[MODES.Full, MODES.FirstHalf, MODES.SecondHalf]}
        onChange={setValue}
        ariaLabel='Day mode'
      />
    )
  },
}
