import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./src/__tests__/setup.ts"],
  },
  resolve: {
    alias: {
      "@repo/schema": path.resolve(__dirname, "../../packages/schema/src"),
      "@repo/db": path.resolve(__dirname, "../../packages/db/src"),
      "@repo/core": path.resolve(__dirname, "../../packages/core/src"),
    },
  },
});
