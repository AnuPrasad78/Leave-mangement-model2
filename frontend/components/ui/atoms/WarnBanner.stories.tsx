import type { Meta, StoryObj } from '@storybook/react'
import { WarnBanner } from './WarnBanner'

const meta: Meta<typeof WarnBanner> = {
  title: 'UI/Atoms/WarnBanner',
  component: WarnBanner,
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof WarnBanner>

export const SeparationWarning: Story = {
  args: {
    children: 'This employee has a pending separation notice. Requests submitted here may not be approved.',
  },
}

export const SingleLine: Story = {
  args: { children: 'Optional holiday requests cannot be cancelled once approved.' },
}
