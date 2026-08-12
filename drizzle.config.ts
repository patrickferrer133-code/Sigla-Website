import { config } from "dotenv";
config({ path: ".env.local" });

import { defineConfig } from "drizzle-kit";

// `generate` only diffs the schema against the migrations journal and never
// dials the database, so a placeholder keeps it usable before DATABASE_URL
// is set. `migrate` (lib/db/migrate.ts) enforces the real value itself.
const databaseUrl = process.env.DATABASE_URL ?? "postgresql://placeholder/placeholder";

export default defineConfig({
  out: "./lib/db/migrations",
  schema: "./lib/db/schema/index.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
});
