import { defineConfig } from 'vitest/config'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
    include: ['**/*.test.ts', '**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: ['node_modules/', 'dist/', '**/*.d.ts'],
    },
  },
  resolve: {
    alias: [
      { find: '@/features', replacement: path.resolve(__dirname, './src/features') },
      { find: '@/shared', replacement: path.resolve(__dirname, './src/shared') },
      { find: '@/config', replacement: path.resolve(__dirname, './src/config') },
      { find: '@/components', replacement: path.resolve(__dirname, './components') },
      { find: '@/lib', replacement: path.resolve(__dirname, './lib') },
      { find: '@', replacement: path.resolve(__dirname, './') },
    ],
  },
})