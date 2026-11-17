import type { Meta, StoryObj } from '@storybook/react'
import { fn } from '@storybook/test'
import { useState } from 'react'
import { Pager } from './Pager'

const meta: Meta<typeof Pager> = {
  title: 'UI/Molecules/Pager',
  component: Pager,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof Pager>

export const MiddlePage: Story = {
  args: { page: 2, pageCount: 5, onChange: fn() },
}

export const FirstPage: Story = {
  args: { page: 1, pageCount: 5, onChange: fn() },
}

export const LastPage: Story = {
  args: { page: 5, pageCount: 5, onChange: fn() },
}

export const SinglePage: Story = {
  // Contract: renders nothing while the list fits on one page.
  args: { page: 1, pageCount: 1, onChange: fn() },
}

/* Interactive demo — the parent owns the page state. */
export const Interactive: Story = {
  args: { page: 1, pageCount: 5, onChange: fn() },
  render: function InteractivePager(args) {
    const [page, setPage] = useState(args.page)
    return (
      <div style={{ minWidth: 320 }}>
        <Pager
          page={page}
          pageCount={args.pageCount}
          onChange={(next) => {
            args.onChange?.(next)
            setPage(next)
          }}
        />
      </div>
    )
  },
}
