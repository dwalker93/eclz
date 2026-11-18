import { afterAll, describe, test } from "bun:test";
import { seedDefaults } from "../src/seed";
import { eq, rejects } from "./helpers";
import { createTestDb } from "./setup";

const { db, q, close } = await createTestDb();
const seeded = await seedDefaults(db, { organizationName: "Test Institute", type: "institution" });
afterAll(async () => {
  await close();
});

describe("provisioning seed", () => {
  test("13 grades, 5 roles, default payment method is bank transfer", async () => {
    const g = await q(`SELECT count(*)::int AS n FROM grade_level`);
    const r = await q(`SELECT count(*)::int AS n FROM role`);
    const m = await q(`SELECT type FROM payment_method WHERE is_default`);
    eq([g[0]!.n, r[0]!.n, m[0]!.type], [13, 5, "bank_transfer"]);
  });

  test("notification channels: in-app on and the rest off", async () => {
    const r = await q(`SELECT channel, is_enabled FROM notification_channel ORDER BY channel`);
    eq(r.length, 4);
    eq(r.filter((x) => x.is_enabled).map((x) => x.channel), ["in_app"]);
  });

  test("creates one organization with a default branch", async () => {
    eq((await q(`SELECT count(*)::int AS n FROM organization`))[0]!.n, 1);
    eq((await q(`SELECT id FROM branch`)).map((b) => b.id), [seeded.defaultBranchId]);
  });

  test("cannot run twice on one deployment", () =>
    rejects(/organization_singleton/, () => seedDefaults(db, { organizationName: "Again", type: "individual" })));
});
