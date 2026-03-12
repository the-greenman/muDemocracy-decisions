import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: [],
    env: {
      DATABASE_URL:
        "postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_test",
    },
  },
  resolve: {
    alias: {
      "@repo/db": path.resolve(__dirname, "./src"),
      "@repo/schema": path.resolve(__dirname, "../schema/src"),
      "@repo/core": path.resolve(__dirname, "../core/src"),
    },
  },
});
