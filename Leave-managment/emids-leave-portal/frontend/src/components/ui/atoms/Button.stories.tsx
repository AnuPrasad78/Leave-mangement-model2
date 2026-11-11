import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'

const meta = {
  title: 'UI/Atoms/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: { control: 'inline-radio' },
    size: { control: 'inline-radio' },
    onClick: { action: 'clicked' },
  },
} satisfies Meta<typeof Button>

export default meta
type Story = StoryObj<typeof meta>

export const Primary: Story = {
  args: { children: 'Submit Request' },
}

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Cancel' },
}

export const Danger: Story = {
  args: { variant: 'danger', children: 'Deactivate account' },
}

export const Small: Story = {
  args: { variant: 'ghost', size: 'sm', children: 'Next →' },
}

export const Disabled: Story = {
  args: { children: 'Submit Request', disabled: true },
}

/** The busy state swaps children for busyLabel and shows the spinner. */
export const Busy: Story = {
  args: { children: 'Save', busy: true, busyLabel: 'Saving…' },
}
