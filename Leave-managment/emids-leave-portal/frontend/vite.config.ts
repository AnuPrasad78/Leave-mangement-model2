import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: { port: 5173 },
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
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'src/main.tsx',
        'src/vite-env.d.ts',
        'src/**/types/**',
        'src/**/*.d.ts',
        'tests/**',
        'src/**/__mocks__/**',
      ],
    },
  },
})
