import type { Meta, StoryObj } from '@storybook/react'
import type { ReactNode } from 'react'
import { Toast } from './Toast'
import { AuthContext } from '../../../store/AuthContext'

// Toast reads the current toast state from the auth store (setToast pushes
// into it). In stories we pin the store to the value the story is about.
function ToastProvider({ msg, kind, id, children }: { msg: string; kind: string; id: number; children: ReactNode }) {
  return (
    <AuthContext.Provider value={{ toast: { msg, kind, id } } as unknown as AuthContextValue}>
      {children}
    </AuthContext.Provider>
  )
}

// Minimal type import stands in for the store's real context shape.
type AuthContextValue = Parameters<typeof AuthContext.Provider>[0]['value']

const meta = {
  title: 'UI/Atoms/Toast',
  component: Toast,
  tags: ['autodocs'],
  parameters: { layout: 'centered' },
} satisfies Meta<typeof Toast>

export default meta
type Story = StoryObj<typeof meta>

export const Success: Story = {
  render: () => (
    <ToastProvider msg='Paid Time Off request submitted · 2 day(s)' kind='ok' id={1}>
      <Toast />
    </ToastProvider>
  ),
}

export const Error: Story = {
  render: () => (
    <ToastProvider msg='Unknown or inactive leave type' kind='red' id={2}>
      <Toast />
    </ToastProvider>
  ),
}
