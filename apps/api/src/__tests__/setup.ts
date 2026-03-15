import { execSync } from "node:child_process";

process.env.DATABASE_URL =
  "postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_test";
process.env.USE_MOCK_LLM = "true";

execSync("pnpm --filter @repo/db db:migrate", {
  cwd: new URL("../../../../", import.meta.url),
  env: {
    ...process.env,
    DATABASE_URL: "postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_test",
  },
  stdio: "inherit",
});
