import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// Next.js dev mode hot-reloads server modules on every file save, which
// would otherwise re-run this file and open a brand new connection pool
// each time — old pools are never closed, so the Supabase pooler fills up
// with orphaned connections and every query starts queueing. Caching the
// client on globalThis survives Fast Refresh so dev keeps reusing one pool.
const globalForDb = globalThis as unknown as { __sigla_queryClient?: postgres.Sql };

const queryClient =
  globalForDb.__sigla_queryClient ?? postgres(process.env.DATABASE_URL, { prepare: false });

if (process.env.NODE_ENV !== "production") {
  globalForDb.__sigla_queryClient = queryClient;
}

export const db = drizzle(queryClient, { schema });
