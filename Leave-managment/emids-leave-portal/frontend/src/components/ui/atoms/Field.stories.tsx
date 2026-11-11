import type { Meta, StoryObj } from '@storybook/react'
import { Field } from './Field'

const meta = {
  title: 'UI/Atoms/Field',
  component: Field,
  tags: ['autodocs'],
} satisfies Meta<typeof Field>

export default meta
type Story = StoryObj<typeof meta>

export const Clean: Story = {
  args: { label: 'Last Working Day', required: true },
  render: (args) => (
    <Field {...args} htmlFor='lwd'>
      <input id='lwd' className='input' type='date' />
    </Field>
  ),
}

/** Validation errors render as the red `field__error` line. */
export const WithError: Story = {
  args: { label: 'Last Working Day', required: true, error: 'Last working day must be in the future.' },
  render: (args) => (
    <Field {...args} htmlFor='lwd'>
      <input id='lwd' className='input' type='date' />
    </Field>
  ),
}

/** The error markup stays accessible: aria-invalid + aria-describedby. */
export const OptionalWithNote: Story = {
  args: { label: 'Remarks' },
  render: (args) => (
    <Field {...args} htmlFor='remarks'>
      <textarea id='remarks' className='textarea' maxLength={500} />
    </Field>
  ),
}
