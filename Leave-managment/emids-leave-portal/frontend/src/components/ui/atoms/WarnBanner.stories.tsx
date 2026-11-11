import type { Meta, StoryObj } from '@storybook/react'
import { WarnBanner } from './WarnBanner'

const meta = {
  title: 'UI/Atoms/WarnBanner',
  component: WarnBanner,
  tags: ['autodocs'],
} satisfies Meta<typeof WarnBanner>

export default meta
type Story = StoryObj<typeof meta>

export const LedgerWarning: Story = {
  args: {
    children:
      'Your annual balance shows used beyond credited + opening. Ask the People Success desk to correct the ledger before raising new requests.',
  },
}
