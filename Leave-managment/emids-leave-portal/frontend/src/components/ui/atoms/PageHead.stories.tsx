import type { Meta, StoryObj } from '@storybook/react'
import { PageHead } from './PageHead'

const meta = {
  title: 'UI/Atoms/PageHead',
  component: PageHead,
  tags: ['autodocs'],
} satisfies Meta<typeof PageHead>

export default meta
type Story = StoryObj<typeof meta>

export const Basic: Story = {
  args: { eyebrow: 'New Request', title: 'Request time off.' },
}

export const WithLeadParagraph: Story = {
  args: { eyebrow: 'My Requests', title: 'Leave details.' },
  render: (args) => (
    <PageHead {...args}>
      <p>Everything you have raised in the current leave year — newest first.</p>
    </PageHead>
  ),
}

export const Accent: Story = {
  args: { eyebrow: 'Administration', title: 'People.', accent: true },
}
