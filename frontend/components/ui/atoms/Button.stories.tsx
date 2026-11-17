import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { Button, type ButtonProps } from './Button'

const meta: Meta<typeof Button> = {
  title: 'UI/Atoms/Button',
  component: Button,
  args: { onClick: fn() },
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof Button>

export const Primary: Story = {
  args: { variant: 'primary', children: 'Submit request' },
}

export const Ghost: Story = {
  args: { variant: 'ghost', children: 'Cancel' },
}

export const Danger: Story = {
  args: { variant: 'danger', children: 'Delete employee' },
}

export const Small: Story = {
  args: { variant: 'primary', size: 'sm', children: 'Approve' },
}

export const Busy: Story = {
  args: { variant: 'primary', busy: true, busyLabel: 'Submitting…', children: 'Submit request' },
}

export const Disabled: Story = {
  args: { variant: 'ghost', disabled: true, children: 'Prev' },
}

export const AllVariants: Story = {
  render: (args: ButtonProps) => (
    <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
      <Button {...args} variant='primary'>
        Primary
      </Button>
      <Button {...args} variant='ghost'>
        Ghost
      </Button>
      <Button {...args} variant='danger'>
        Danger
      </Button>
    </div>
  ),
}
