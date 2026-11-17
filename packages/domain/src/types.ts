import type { PgDatabase } from "drizzle-orm/pg-core";
import type * as schema from "@workspace/db/schema";

/** Any Drizzle Postgres database over the schema: postgres-js in production, PGlite in tests. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type Db = PgDatabase<any, typeof schema>;
export type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];
