import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
    },
  },
  resolve: {
    alias: {
      '@repo/schema': path.resolve(__dirname, '../schema/src'),
      '@repo/db': path.resolve(__dirname, '../db/src'),
    },
  },
});
