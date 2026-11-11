import type { Meta, StoryObj } from '@storybook/react'
import { Field } from './Field'

const meta: Meta<typeof Field> = {
  title: 'UI/Atoms/Field',
  component: Field,
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj

export const Clean: Story = {
  render: () => (
    <Field label='Last Working Day' required htmlFor='lwd'>
      <input id='lwd' className='input' type='date' />
    </Field>
  ),
}

/** Validation errors render as the red `field__error` line. */
export const WithError: Story = {
  render: () => (
    <Field label='Last Working Day' required error='Last working day must be in the future.' htmlFor='lwd'>
      <input id='lwd' className='input' type='date' />
    </Field>
  ),
}

/** The error markup stays accessible: aria-invalid + aria-describedby. */
export const OptionalWithNote: Story = {
  render: () => (
    <Field label='Remarks' htmlFor='remarks'>
      <textarea id='remarks' className='textarea' maxLength={500} />
    </Field>
  ),
}
