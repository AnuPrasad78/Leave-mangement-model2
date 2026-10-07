describe('tooling smoke', () => {
  it('runs vitest with jsdom and jest-dom matchers', () => {
    document.body.appendChild(document.createElement('div'))
    const el = document.querySelector('div')
    expect(el).toBeInTheDocument()
  })
})
