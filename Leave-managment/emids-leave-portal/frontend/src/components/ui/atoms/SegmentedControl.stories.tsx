import { useState } from 'react'
import type { Meta, StoryObj } from '@storybook/react'
import { SegmentedControl } from './SegmentedControl'
import { MODES } from '../../../constants'

const meta: Meta<typeof SegmentedControl> = {
  title: 'UI/Atoms/SegmentedControl',
  component: SegmentedControl,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj

function DayModeDemo() {
  const [value, setValue] = useState<string>(MODES.Full)
  return (
    <SegmentedControl
      value={value}
      options={[MODES.Full, MODES.FirstHalf, MODES.SecondHalf]}
      onChange={(option) => setValue(option)}
      ariaLabel='Day mode'
    />
  )
}

/** Live toggle — the day-mode selector as used in the leave form. */
export const DayMode: Story = {
  render: () => <DayModeDemo />,
}
