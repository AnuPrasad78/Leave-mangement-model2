import { render, screen } from '@testing-library/react'
import { WarnBanner } from '../../../../app/components/index'

describe('ui/WarnBanner', () => {
  it('renders children inside the warn-banner class', () => {
    render(<WarnBanner>Watch out</WarnBanner>)
    const el = screen.getByText('Watch out').closest('.warn-banner')
    expect(el).not.toBeNull()
  })
})
