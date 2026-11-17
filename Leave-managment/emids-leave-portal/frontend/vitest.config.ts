import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup',
    css: false,
    include: ['tests/**/*.test.{js,jsx,ts,tsx}'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      reportsDirectory: 'coverage',
      thresholds: {
        lines: 70,
        branches: 60,
        functions: 65,
        statements: 70,
      },
      include: [
        'app/**/*.{ts,tsx}',
        'services/**/*.ts',
        'store/**/*.{ts,tsx}',
        'hooks/**/*.ts',
        'utils/**/*.{ts,tsx}',
        'constants/**/*.ts',
      ],
      exclude: [
        'app/lib/assets.ts',
        'types/**',
        '**/*.d.ts',
        'tests/**',

      ],
    },
  },
})
