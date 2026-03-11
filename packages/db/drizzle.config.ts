import type { Config } from "drizzle-kit";

export default {
  schema: "./src/schema.ts",
  out: "./drizzle",
  driver: "pg",
  dbCredentials: {
    connectionString:
      process.env.DATABASE_URL ||
      "postgresql://decision_logger:decision_logger@localhost:5433/decision_logger_dev",
  },
  verbose: true,
  strict: false,
} satisfies Config;
