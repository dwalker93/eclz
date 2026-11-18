/**
 * Pure payment arithmetic: money, pro rata split, allocation plan, waterfall, invoice status. No database.
 */
import { describe, test } from "bun:test";
import {
  deriveInvoiceStatus,
  planAllocation,
  splitProRata,
  waterfall,
} from "../src";
import { eq } from "./helpers";

describe("allocation and invoice status (pure functions)", () => {
  test("E7: pro rata split uses largest remainder and sums exactly", async () => {
    const parts = splitProRata(10000, [{ id: "a", weight: 10000 }, { id: "b", weight: 10000 }, { id: "c", weight: 10000 }]);
    eq(parts.map((p) => p.cents), [3334, 3333, 3333]);
    const uneven = splitProRata(100000, [{ id: "a", weight: 170000 }, { id: "b", weight: 100000 }]);
    eq(uneven.reduce((s, p) => s + p.cents, 0), 100000);
    eq(uneven.map((p) => p.cents), [62963, 37037]);
  });

  test("E7: a split never gives an item more than its outstanding", async () => {
    const items = [{ id: "a", weight: 1 }, { id: "b", weight: 1 }, { id: "c", weight: 998 }];
    for (const amount of [1, 2, 3, 500, 999, 1000]) {
      const parts = splitProRata(amount, items);
      eq(parts.reduce((s, p) => s + p.cents, 0), amount, `sum for ${amount}`);
      for (const p of parts) if (p.cents > items.find((i) => i.id === p.id)!.weight) throw new Error("over-allocated");
    }
  });

  test("E7: the default plan fills the oldest due date first", async () => {
    const plan = planAllocation(15000, [
      { invoiceId: "late", issuedOn: "2027-01-01", dueDate: "2027-03-01", items: [{ id: "l1", weight: 10000 }] },
      { invoiceId: "early", issuedOn: "2027-01-01", dueDate: "2027-02-01", items: [{ id: "e1", weight: 10000 }] },
    ]);
    eq(plan.allocations, [
      { invoiceId: "early", invoiceItemId: "e1", cents: 10000 },
      { invoiceId: "late", invoiceItemId: "l1", cents: 5000 },
    ]);
    eq(plan.unallocated, 0);
    eq(planAllocation(30000, [{ invoiceId: "x", issuedOn: "2027-01-01", dueDate: "2027-02-01", items: [{ id: "x1", weight: 10000 }] }]).unallocated, 20000);
  });

  test("E16: the waterfall spills into the next installment", async () => {
    eq(waterfall([100000, 100000, 100000], 150000), [100000, 50000, 0]);
    eq(waterfall([100000, 100000], 250000), [100000, 100000]);
    eq(waterfall([100000], 0), [0]);
  });

  test("invoice status derivation keeps overdue until paid", async () => {
    eq(deriveInvoiceStatus("pending", 100, 40), "partial");
    eq(deriveInvoiceStatus("overdue", 100, 40), "overdue");
    eq(deriveInvoiceStatus("overdue", 100, 100), "paid");
    eq(deriveInvoiceStatus("paid", 100, 0), "pending");
    eq(deriveInvoiceStatus("cancelled", 100, 0), "cancelled");
  });

});
