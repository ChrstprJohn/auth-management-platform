import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    exclude: ['apps/gotrue-admin-web/**', '**/node_modules/**', '**/dist/**'],
    include: [
      'apps/**/*.test.ts',
      'packages/**/*.test.ts',
      'scripts/**/*.test.ts',
    ],
  },
});
