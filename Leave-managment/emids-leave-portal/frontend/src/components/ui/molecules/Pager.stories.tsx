import type { Meta, StoryObj } from '@storybook/react'
import { Pager } from './Pager'

const meta: Meta<typeof Pager> = {
  title: 'UI/Molecules/Pager',
  component: Pager,
  tags: ['autodocs'],
  argTypes: { onChange: { action: 'page change' } },
}

export default meta
type Story = StoryObj

export const Middle: Story = {
  args: { page: 2, pageCount: 5 },
}

export const FirstPage: Story = {
  args: { page: 1, pageCount: 3 },
}

export const LastPage: Story = {
  args: { page: 3, pageCount: 3 },
}

/** Renders null when the content fits on one page. */
export const SinglePage: Story = {
  args: { page: 1, pageCount: 1 },
}
