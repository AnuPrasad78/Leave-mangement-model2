import type { StorybookConfig } from '@storybook/react-vite'

const config: StorybookConfig = {
  // Pick up every story file alongside its component.
  stories: ['../src/**/*.stories.@(ts|tsx)'],
  // essentials = Docs, Controls, Actions, Toolbars & a11y — enough for a component library.
  addons: ['@storybook/addon-essentials'],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
}

export default config
