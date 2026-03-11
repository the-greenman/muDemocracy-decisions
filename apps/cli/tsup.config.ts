import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  dts: false,
  clean: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  external: ["@repo/schema", "@repo/core", "@repo/db"],
});
