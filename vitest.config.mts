import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Integration tests share one SQLite file, so they must not run concurrently.
    fileParallelism: false,
    setupFiles: ['tests/setup.ts'],
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
  resolve: {
    alias: {
      '@': resolve(import.meta.dirname, './src'),
      // `server-only` guards RSC-only modules; harmless no-op under Node tests.
      'server-only': resolve(import.meta.dirname, './tests/server-only-stub.ts'),
    },
  },
});
