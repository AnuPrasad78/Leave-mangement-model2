import { defineConfig } from 'vitest/config'
import { fileURLToPath } from 'node:url'

export default defineConfig({
  // The workspace tsconfig uses "jsx": "preserve" (a Next.js requirement);
  // give Vitest's esbuild transform an automatic runtime instead.
  esbuild: { jsx: 'automatic' },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('.', import.meta.url)),
      '@app': fileURLToPath(new URL('./app', import.meta.url)),
      '@tests': fileURLToPath(new URL('./tests', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: './vitest.setup.ts',
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
      include: ['**/*.{ts,tsx}'],
      exclude: [
        '**/types/**',
        '**/*.d.ts',
        '**/__mocks__/**',
        'app/api/**',
        'tests/**',
        '.next/**',
        'scripts/**',
        'playwright.config.ts',
        'playwright-report/**',
        'test-results/**',
      ],
    },
  },
})
