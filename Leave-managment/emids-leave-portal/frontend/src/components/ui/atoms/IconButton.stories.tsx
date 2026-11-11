import type { Meta, StoryObj } from '@storybook/react'
import { IconButton } from './IconButton'
import { IconBell, IconMenu, IconSearch } from '../../Icons'

const meta = {
  title: 'UI/Atoms/IconButton',
  component: IconButton,
  tags: ['autodocs'],
  argTypes: { onClick: { action: 'clicked' } },
} satisfies Meta<typeof IconButton>

export default meta
type Story = StoryObj<typeof meta>

export const Bell: Story = {
  args: { label: 'Notifications' },
  render: (args) => (
    <IconButton {...args}>
      <IconBell size={21} />
      {/* Unread count pill, appears only when there are notices. */}
      <span className='icon-btn__count'>3</span>
    </IconButton>
  ),
}

export const Menu: Story = {
  args: { label: 'Menu' },
  render: (args) => (
    <IconButton {...args}>
      <IconMenu size={22} />
    </IconButton>
  ),
}

export const Search: Story = {
  args: { label: 'Search' },
  render: (args) => (
    <IconButton {...args}>
      <IconSearch size={21} />
    </IconButton>
  ),
}

export const OpenState: Story = {
  args: { label: 'Notifications', className: 'header__profile is-open' },
  render: (args) => (
    <IconButton {...args}>
      <IconBell size={21} />
    </IconButton>
  ),
}
