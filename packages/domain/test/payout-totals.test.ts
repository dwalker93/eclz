/**
 * Pure payout helpers: entry totals and what blocks a payout. No database.
 */
import { describe, test } from "bun:test";
import {
  payoutBlocker,
  summarizeEntries,
} from "../src";
import { eq } from "./helpers";

describe("payout totals (pure functions)", () => {

  test("summarizeEntries and payoutBlocker", async () => {
    const e = (b: string, c: string, t: string) => ({ baseAmount: b, commissionAmount: c, teacherAmount: t });
    const t = summarizeEntries([e("10000.00", "1000.00", "9000.00"), e("-2000.00", "-200.00", "-1800.00")]);
    eq([t.gross, t.commission, t.net, t.entryCount], [800000, 80000, 720000, 2]);
    eq(payoutBlocker(t), null);
    eq(payoutBlocker(summarizeEntries([])), "no_entries");
    eq(payoutBlocker(summarizeEntries([e("-100.00", "-10.00", "-90.00")])), "net_not_positive");
    eq(payoutBlocker(summarizeEntries([e("0.00", "0.00", "0.00")])), "net_not_positive");
    // net is positive while the gross and commission totals are negative (a reversal of 1000/900/100 plus a new accrual of 500/0/500)
    const heavy = summarizeEntries([e("-1000.00", "-900.00", "-100.00"), e("500.00", "0.00", "500.00")]);
    eq([heavy.gross, heavy.commission, heavy.net], [-50000, -90000, 40000]);
    eq(payoutBlocker(heavy), null);
  });

});
