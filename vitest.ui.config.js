import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

// `npm test` / `npm run test:watch` 用 — emulator 不要の UI テスト (tests/ 直下) のみ実行する。
// tests/api, tests/rules, tests/unit, tests/e2e は emulator + 環境変数 (TEST_BYPASS_AUTH=1,
// NODE_ENV=test, FIRESTORE_EMULATOR_HOST 等) 必須のため、別 config (vitest.config.js) +
// 専用 npm scripts (test:unit, test:rules, test:api, test:e2e) で実行する。
export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['tests/setup.js'],
    include: [
      'tests/*.test.{js,jsx,mjs,ts,tsx}',
      'tests/utils/**/*.test.{js,jsx,mjs,ts,tsx}',
      'src/**/__tests__/*.test.{js,jsx,ts,tsx}',
      'src/**/*.test.{js,jsx,ts,tsx}',
    ],
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      'tests/send-email.test.mjs',
      'tests/check-user.mjs',
    ],
  },
});
