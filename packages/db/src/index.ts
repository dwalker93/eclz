import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

export * from "./schema";
export { schema };

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

export { seedDefaults, STARTER_PERMISSIONS, STARTER_ROLES, type SeedOptions } from "./seed";
export * from "./services";
