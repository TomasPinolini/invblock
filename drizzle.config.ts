import "dotenv/config";
import type { Config } from "drizzle-kit";

// Load .env.local for local development
import { config } from "dotenv";
config({ path: ".env.local" });

export default {
  schema: "./src/db/schema.ts",
  out: "./src/db/migrations",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
} satisfies Config;
