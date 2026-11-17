/**
 * Provisioning seed for one customer deployment. Run once, right after the migrations:
 *
 *   DATABASE_URL=... ORG_NAME="Acme Tuition" ORG_TYPE=institution bun run db:seed
 *
 * ORG_TYPE is "individual" (solo teacher) or "institution". Module switches can be set afterwards
 * in organization.enabled_modules.
 */
import { createDb, seedDefaults } from "../src/index";

const url = process.env.DATABASE_URL;
const name = process.env.ORG_NAME;
const type = process.env.ORG_TYPE;
if (!url || !name || (type !== "individual" && type !== "institution")) {
  console.error('Set DATABASE_URL, ORG_NAME and ORG_TYPE ("individual" or "institution").');
  process.exit(1);
}

const { db, client } = createDb(url);
try {
  const result = await seedDefaults(db, { organizationName: name, type });
  console.log("Seeded:", result);
} finally {
  await client.end();
}
