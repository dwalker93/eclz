import { defineConfig } from "drizzle-kit";

// DATABASE_URL is read from the environment of each customer deployment.
// Never commit an .env file.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/schema/index.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://localhost:5432/placeholder",
  },
  strict: true,
  verbose: true,
});
