import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: false, // Disable DTS generation due to circular dependency issues
  clean: true,
  external: ['@repo/schema', 'drizzle-orm', 'postgres'],
});
