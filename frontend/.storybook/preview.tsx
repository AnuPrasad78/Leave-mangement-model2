import type { Preview } from '@storybook/react'
import '../styles/global.css'
import '../styles/layout.css'
import '../styles/pages.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'portal',
      values: [
        // Matches the app's own page background so atoms with transparent
        // fills don't appear broken against the default white canvas.
        { name: 'portal', value: 'var(--canvas, #f2f2f0)' },
        { name: 'dark', value: '#152125' },
      ],
    },
  },
}

export default preview
