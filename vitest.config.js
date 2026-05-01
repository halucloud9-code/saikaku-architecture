import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'node',
    environmentMatchGlobs: [
      ['tests/unit/**/*.jsx', 'jsdom'],
      ['tests/unit/**/*.tsx', 'jsdom'],
      ['tests/unit/ui/**', 'jsdom'],
    ],
    setupFiles: ['tests/setup.js'],
    testTimeout: 30000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
});
