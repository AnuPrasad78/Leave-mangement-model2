import type { Meta, StoryObj } from '@storybook/react'
import { Button } from './Button'
import { PageHead } from './PageHead'

const meta: Meta<typeof PageHead> = {
  title: 'UI/Atoms/PageHead',
  component: PageHead,
  parameters: { layout: 'padded' },
}

export default meta
type Story = StoryObj<typeof PageHead>

export const Plain: Story = {
  args: { eyebrow: 'Leave management', title: 'Request time off' },
}

export const WithAccent: Story = {
  args: { eyebrow: 'Admin', title: 'Employees', accent: true },
}

export const WithActions: Story = {
  args: { eyebrow: 'Manager', title: 'Team requests' },
  render: function HeaderWithActions(args) {
    return (
      <PageHead {...args}>
        <div style={{ display: 'flex', gap: 12, marginTop: 12 }}>
          <Button variant='primary' size='sm'>
            Approve selected
          </Button>
          <Button variant='ghost' size='sm'>
            Export CSV
          </Button>
        </div>
      </PageHead>
    )
  },
}
