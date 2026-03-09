import { defineConfig } from 'tsup';

export default defineConfig((options) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false,
  clean: !options.watch,
  external: ['@repo/schema', '@repo/db'],
}));
