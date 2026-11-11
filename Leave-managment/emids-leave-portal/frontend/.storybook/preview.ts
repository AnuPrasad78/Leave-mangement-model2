import type { Preview } from '@storybook/react'

// Load the real app styles so stories render with production styling.
import '../src/styles/global.css'
import '../src/styles/layout.css'
import '../src/styles/pages.css'
import '../src/styles/login.css'

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/i,
      },
    },
    backgrounds: {
      default: 'canvas',
      values: [
        { name: 'canvas', value: '#f2f5f4' },
        { name: 'surface', value: '#ffffff' },
        { name: 'dark', value: '#0e1f1e' },
      ],
    },
    // Don't let the story width dictate the canvas — components flex.
    layout: 'padded',
  },
}

export default preview
