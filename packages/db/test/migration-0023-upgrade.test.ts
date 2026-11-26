import { afterAll, afterEach, describe, expect, test } from "bun:test";
import { readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { btree_gist } from "@electric-sql/pglite/contrib/btree_gist";

const dir = resolve(import.meta.dir, "../drizzle");
const tags = (JSON.parse(readFileSync(join(dir, "meta/_journal.json"), "utf8")) as { entries: { tag: string }[] }).entries.map((e) => e.tag);
const apply = (pg: PGlite, tag: string) => pg.exec(readFileSync(join(dir, `${tag}.sql`), "utf8"));
const message = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return String((e as Error).message);
  }
  return "";
};

describe("upgrade across 0023: paid purchases with no invoice", () => {
  const pg = new PGlite({ extensions: { btree_gist } });
  afterAll(() => pg.close());
  // A fixture that fails between SET ... replica and the reset must not leave the next test running without foreign keys and triggers.
  afterEach(() => pg.exec(`SET session_replication_role = DEFAULT`));

  test("0023 lists the purchases, says a handed-over one needs its invoice or reconciled handover records, and runs once each is repaired", async () => {
    const at = tags.indexOf("0022_content_purchase_paid_invoice");
    const validate = tags.indexOf("0023_validate_content_purchase_paid_invoice");
    for (const t of tags.slice(0, at)) await apply(pg, t);

    // fixtures only: the parents of a purchase are not what this test is about
    await pg.exec(`SET session_replication_role = replica`);
    const purchase = async (status: string, invoice: string | null, handed: boolean) =>
      (await pg.query<{ id: string }>(
        `INSERT INTO content_purchase (content_id, student_id, invoice_id, branch_id, channel, price, status, handed_over_at, handed_over_by)
         VALUES ($1, $2, $3, $4, 'physical', 10, $5, ${handed ? "now()" : "NULL"}, ${handed ? "$6" : "NULL"}) RETURNING id`,
        handed ? [crypto.randomUUID(), crypto.randomUUID(), invoice, crypto.randomUUID(), status, crypto.randomUUID()] : [crypto.randomUUID(), crypto.randomUUID(), invoice, crypto.randomUUID(), status],
      )).rows[0]!.id;
    const handedOver = await purchase("paid", null, true);
    const plain = await purchase("paid", null, false);
    const fine = await purchase("paid", crypto.randomUUID(), false);
    await pg.exec(`SET session_replication_role = origin`);

    for (const t of tags.slice(at, validate)) await apply(pg, t);
    const msg = await message(apply(pg, tags[validate]!));
    expect(msg).toMatch(/2 paid content purchase\(s\) have no invoice/);
    expect(msg).toContain(handedOver);
    expect(msg).toContain(plain);
    expect(msg).not.toContain(fine);
    expect(msg).toMatch(/1 of them were handed over \(first ids: [^)]*\)/);
    expect(msg).toMatch(/content_purchase_handover_check/);
    expect(msg).toMatch(/matching invoice, or reconcile its handover records/);
    expect(msg).toMatch(/do not clear the handover history/);

    // the advice for a handed-over purchase is not a bare status change: that is refused
    await expect(pg.query(`UPDATE content_purchase SET status = 'cancelled' WHERE id = $1`, [handedOver])).rejects.toThrow(/content_purchase_handover_check/);

    // a purchase that was not handed over only gets the short message
    await pg.exec(`SET session_replication_role = replica`);
    await pg.query(`UPDATE content_purchase SET invoice_id = $2 WHERE id = $1`, [handedOver, crypto.randomUUID()]);
    await pg.exec(`SET session_replication_role = origin`);
    const second = await message(apply(pg, tags[validate]!));
    expect(second).toMatch(/1 paid content purchase\(s\) have no invoice/);
    expect(second).not.toMatch(/handed over/);

    await pg.query(`UPDATE content_purchase SET status = 'cancelled' WHERE id = $1`, [plain]);
    await apply(pg, tags[validate]!);
    expect((await pg.query<{ convalidated: boolean }>(`SELECT convalidated FROM pg_constraint WHERE conname = 'content_purchase_paid_invoice_check'`)).rows).toEqual([{ convalidated: true }]);
  });
});
