import { config } from "dotenv";
config({ path: ".env.local" });

import { drizzle } from "drizzle-orm/postgres-js";
import { migrate } from "drizzle-orm/postgres-js/migrator";
import postgres from "postgres";

async function main() {
  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
  }

  // prepare: false is required against the Supabase transaction pooler
  // (PgBouncer transaction mode does not support prepared statements).
  const migrationClient = postgres(process.env.DATABASE_URL, { max: 1, prepare: false });
  const db = drizzle(migrationClient);

  console.log("Running migrations...");
  await migrate(db, { migrationsFolder: "./lib/db/migrations" });
  console.log("Migrations complete.");

  await migrationClient.end();
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
