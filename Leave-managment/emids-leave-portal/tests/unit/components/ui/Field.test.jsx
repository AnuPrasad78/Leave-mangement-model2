import { render, screen } from '@testing-library/react'
import { Field } from '../../../../src/components/ui'

describe('ui/Field', () => {
  it('renders the pinned markup for a label-wrapped required field', () => {
    render(
      <Field label='Corporate Email' required htmlFor='email'>
        <input id='email' className='input' />
      </Field>
    )
    const label = screen.getByText('Corporate Email').closest('label')
    expect(label).toHaveClass('field')
    expect(label).toHaveAttribute('for', 'email')
    expect(label.querySelector('.field__label')).toHaveTextContent('Corporate Email')
    expect(label.querySelector('.field__label .req')).toBeInTheDocument()
    expect(label.querySelector('input')).toHaveClass('input')
  })

  it('omits the asterisk when not required', () => {
    render(
      <Field label='Optional note'>
        <input />
      </Field>
    )
    expect(document.querySelector('.req')).toBeNull()
  })

  it('renders the error span with pinned classes', () => {
    render(
      <Field label='Reason' required htmlFor='reason' error='Tell the approver why.'>
        <input id='reason' />
      </Field>
    )
    const err = screen.getByText('Tell the approver why.')
    expect(err).toHaveClass('muted mono')
  })

  it('associates the error with the input for assistive tech', () => {
    render(
      <Field label='Reason' required htmlFor='reason' error='Pick a date.'>
        <input id='reason' />
      </Field>
    )
    const input = document.getElementById('reason')
    expect(input).toHaveAttribute('aria-invalid', 'true')
    expect(input).toHaveAttribute('aria-describedby', 'reason-error')
    expect(screen.getByText('Pick a date.').id).toBe('reason-error')
  })

  it('does not pollute the control attributes when there is no error', () => {
    render(
      <Field label='Reason' htmlFor='reason'>
        <input id='reason' />
      </Field>
    )
    const input = document.getElementById('reason')
    expect(input).not.toHaveAttribute('aria-invalid')
    expect(input).not.toHaveAttribute('aria-describedby')
  })

  it('supports the div-wrapped variant (toggle chip fields) without htmlFor', () => {
    render(
      <Field label='Leave Type' required as='div'>
        <button type='button'>Paid Time Off</button>
      </Field>
    )
    const box = screen.getByText('Leave Type').closest('div.field')
    expect(box).not.toBeNull()
    expect(screen.getByRole('button', { name: 'Paid Time Off' })).toBeInTheDocument()
  })
})
