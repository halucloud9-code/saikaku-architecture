import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// このファイルは tests/api, tests/rules, tests/unit, tests/e2e (emulator + env vars 必須) を含む
// **全テストの共通基盤**。`npm run test:unit/rules/api/e2e` から CLI 引数指定で参照される。
// `npm test` (UI テストのみ、emulator 不要) は別ファイル `vitest.ui.config.js` を使う。
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
