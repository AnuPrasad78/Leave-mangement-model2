import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { IconBell, IconMenu, IconSearch } from '../../Icons'
import { IconButton } from './IconButton'

const meta: Meta<typeof IconButton> = {
  title: 'UI/Atoms/IconButton',
  component: IconButton,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof IconButton>

export const Menu: Story = {
  args: { label: 'Open menu', onClick: fn(), children: <IconMenu size={18} /> },
}

export const Search: Story = {
  args: { label: 'Search', onClick: fn(), children: <IconSearch size={18} /> },
}

export const Notification: Story = {
  args: { label: 'Notifications', onClick: fn(), children: <IconBell size={18} /> },
}

export const OnState: Story = {
  args: { label: 'Notifications (active)', isOn: true, onClick: fn(), children: <IconBell size={18} /> },
}
