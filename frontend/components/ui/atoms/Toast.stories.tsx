import type { Meta, StoryObj } from '@storybook/react'
import { AuthContext, type AuthContextValue, type ToastModel } from '../../../store/AuthContext'
import { Toast } from './Toast'

const meta: Meta<typeof Toast> = {
  title: 'UI/Atoms/Toast',
  component: Toast,
  parameters: { layout: 'centered' },
}

export default meta
type Story = StoryObj<typeof Toast>

// The atom reads `toast` off the auth context. Stories inject a minimal stub
// so the toast can be shown in isolation — no services, no auth flow, per the
// module-boundary rules in frontend/CLAUDE.md.
const stubContext = (toast: ToastModel) => ({ toast } as unknown as AuthContextValue)

export const GreenToast: Story = {
  decorators: [
    (Story) => (
      <AuthContext.Provider value={stubContext({ id: 1, kind: 'ok', msg: 'Leave request submitted' })}>
        <Story />
      </AuthContext.Provider>
    ),
  ],
}

export const RedToast: Story = {
  decorators: [
    (Story) => (
      <AuthContext.Provider value={stubContext({ id: 2, kind: 'red', msg: 'Not enough balance left this year' })}>
        <Story />
      </AuthContext.Provider>
    ),
  ],
}
