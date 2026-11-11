import { fn } from '@storybook/test'
import type { Meta, StoryObj } from '@storybook/react'
import { Pager } from './Pager'

const meta = {
  title: 'UI/Molecules/Pager',
  component: Pager,
  tags: ['autodocs'],
  args: { onChange: fn() },
} satisfies Meta<typeof Pager>

export default meta
type Story = StoryObj<typeof meta>

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
