import type { StorybookConfig } from '@storybook/react-webpack5'

// NOTE: Deliberately @storybook/react-webpack5 rather than @storybook/nextjs.
// The nextjs framework drives its build through Next's bundled webpack
// (next/dist/compiled/webpack/bundle5.js), which fails with
// "Cannot read properties of undefined (reading 'tap')" during the
// html-webpack-plugin child compilation on the current Next 14.2.33 bundle.
// None of the UI atoms/molecules (dominated by pure React + CSS, no next/*)
// depend on Next-specific APIs, so the plain React framework loses nothing.

const config: StorybookConfig = {
  // Stories live beside the atomic layers documented in frontend/CLAUDE.md:
  // ui/atoms first, then ui/molecules and the feature organisms.
  stories: ['../components/**/*.stories.@(ts|tsx)'],
  addons: ['@storybook/addon-essentials', '@storybook/addon-a11y'],
  framework: {
    name: '@storybook/react-webpack5',
    options: {},
  },
  // Serve the same static assets the app serves (e.g. /emids-mark.svg).
  staticDirs: ['../public'],
  webpackFinal: (config) => {
    // Two related problems with the toolchain here (both diagnosed from the
    // installed packages — see git history note in memory):
    //
    // 1. webpack 5.112 (resolved by @storybook/builder-webpack5 8.6.19)
    //    auto-enables `experiments.typescript` on Node >= 22.6, and its
    //    TypeScriptPlugin hard-throws on every .tsx module ("experiments.
    //    typescript does not support .tsx/JSX") and its auto-enable check
    //    never considers .tsx rules, so it cannot be stepped aside from.
    // 2. Storybook 8.6's react-webpack5 stack registers NO babel/TS loader
    //    at all — it now relies on webpack's native TS stripping ("Storybook
    //    now supports TypeScript natively"), which cannot handle JSX.
    //
    // So: disable the native experiment and register esbuild-loader for
    // TS/TSX ourselves. esbuild-loader reuses the esbuild 0.21.x already in
    // node_modules (peer >= 0.18), no new binary download. `jsx: automatic`
    // lets stories/components use JSX without a React import in scope.
    config.module = config.module ?? {}
    // RuleSetRules is structural; a loose cast keeps this hook type-safe
    // without pulling webpack's full declaration surface into this file.
    const existingRules = (config.module.rules ?? []) as unknown[]
    config.module.rules = [
      ...existingRules,
      {
        test: /\.(ts|tsx)$/,
        exclude: /node_modules/,
        loader: 'esbuild-loader',
        options: { loader: 'tsx', target: 'es2022', jsx: 'automatic' },
      },
    ]
    config.experiments = { ...config.experiments, typescript: false }
    return config
  },
}

export default config
