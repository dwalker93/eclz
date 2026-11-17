import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Creates a database client from a connection string.
 * `prepare: false` keeps it compatible with pooled connections (for example on Vercel).
 * Each customer deployment passes its own DATABASE_URL.
 */
export function createDb(databaseUrl: string) {
  const client = postgres(databaseUrl, { prepare: false });
  const db = drizzle(client, { schema });
  return { db, client };
}

export type Database = ReturnType<typeof createDb>["db"];
