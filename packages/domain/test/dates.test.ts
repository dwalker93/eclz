/**
 * Pure date, installment schedule and discount helpers. No database.
 */
import { describe, test } from "bun:test";
import {
  addDays,
  addMonths,
  buildInstallmentSchedule,
  discountCents,
  localDate,
  monthlyPeriods,
} from "../src";
import { eq } from "./helpers";

describe("dates, schedules and discounts (pure functions)", () => {

  test("addDays and addMonths clamp to month end", async () => {
    eq(addDays("2027-02-27", 3), "2027-03-02");
    eq(addMonths("2027-01-31", 1), "2027-02-28");
    eq(addMonths("2028-01-31", 1), "2028-02-29");
    eq(addMonths("2027-03-15", 12), "2028-03-15");
  });

  test("monthlyPeriods are calendar months from the start month", async () => {
    const p = monthlyPeriods("2027-01-20", "2027-03-01");
    eq(p.map((x) => x.start), ["2027-01-01", "2027-02-01", "2027-03-01"]);
    eq(p[0]!.end, "2027-02-01");
  });

  test("localDate uses the time zone, not UTC", async () => {
    eq(localDate(new Date("2027-01-01T20:00:00Z"), "Asia/Colombo"), "2027-01-02");
    eq(localDate(new Date("2027-01-01T20:00:00Z"), "UTC"), "2027-01-01");
  });

  test("installment schedule: down payment first, sums exactly", async () => {
    const s = buildInstallmentSchedule({ total: 100000, count: 3, downPaymentPercent: "40", intervalDays: 30, issuedOn: "2027-01-01" });
    eq(s.map((x) => x.cents), [40000, 30000, 30000]);
    eq(s.map((x) => x.dueDate), ["2027-01-01", "2027-01-31", "2027-03-02"]);
    const t = buildInstallmentSchedule({ total: 10000, count: 3, downPaymentPercent: "0", intervalDays: 7, issuedOn: "2027-01-01" });
    eq(t.map((x) => x.cents), [3334, 3333, 3333]);
  });

  test("discountCents: percent rounds half up and never exceeds the base", async () => {
    eq(discountCents(100000, "percent", "10"), 10000);
    eq(discountCents(100000, "percent", "100"), 100000);
    eq(discountCents(5000, "fixed", "9000"), 5000);
    eq(discountCents(333, "percent", "50"), 167);
  });

});
