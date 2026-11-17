/**
 * Pure access and overdue helpers. No database.
 */
import { describe, test } from "bun:test";
import {
  accessState,
  evaluateOverdue,
  hasAccess,
  resolveOverdueSettings,
} from "../src";
import { eq } from "./helpers";

describe("effective access and overdue rules (pure functions)", () => {

  test("C8: effective access and the reason it is denied", async () => {
    const e = { status: "active", accessStartsOn: "2027-01-01", accessEndsOn: null, accessStatus: "active" };
    eq(accessState(e, "2027-03-10"), { allowed: true });
    eq(accessState({ ...e, status: "completed" }, "2027-03-10"), { allowed: true });
    eq(accessState({ ...e, status: "dropped" }, "2027-03-10"), { allowed: false, reason: "not_active" });
    eq(accessState(e, "2026-12-31"), { allowed: false, reason: "not_started" });
    eq(accessState({ ...e, accessEndsOn: "2027-03-10" }, "2027-03-09"), { allowed: true });
    eq(accessState({ ...e, accessEndsOn: "2027-03-10" }, "2027-03-10"), { allowed: false, reason: "ended" });
    eq(accessState({ ...e, accessStatus: "restricted" }, "2027-03-10"), { allowed: false, reason: "restricted" });
    eq(hasAccess(e, "2027-03-10"), true);
  });

  test("C9: settings come from the fee option field by field, else the organization", async () => {
    const org = { overdueGraceDays: 7, overdueAction: "notify" };
    eq(resolveOverdueSettings(org, null), { graceDays: 7, action: "notify", notify: true, restrict: false });
    eq(resolveOverdueSettings(org, { overdueGraceDays: null, overdueAction: null }).graceDays, 7);
    eq(resolveOverdueSettings(org, { overdueGraceDays: 30, overdueAction: null }), { graceDays: 30, action: "notify", notify: true, restrict: false });
    eq(resolveOverdueSettings(org, { overdueGraceDays: null, overdueAction: "restrict" }), { graceDays: 7, action: "restrict", notify: false, restrict: true });
    eq(resolveOverdueSettings(org, { overdueGraceDays: 0, overdueAction: "none" }), { graceDays: 0, action: "none", notify: false, restrict: false });
  });

  test("C9: overdue starts the day after the grace period, per installment when there are some", async () => {
    const inv = { dueDate: "2027-03-01", total: "100.00", amountPaid: "0.00", installments: [] };
    eq(evaluateOverdue(inv, 7, "2027-03-08").overdue, false);
    eq(evaluateOverdue(inv, 7, "2027-03-09").overdue, true);
    eq(evaluateOverdue(inv, 0, "2027-03-02").overdue, true);
    eq(evaluateOverdue({ ...inv, amountPaid: "100.00" }, 0, "2027-12-01").overdue, false);
    const inst = { ...inv, installments: [
      { seq: 1, dueDate: "2027-02-01", amount: "50.00", amountPaid: "50.00" },
      { seq: 2, dueDate: "2027-03-01", amount: "50.00", amountPaid: "10.00" },
    ] };
    eq(evaluateOverdue(inst, 7, "2027-03-08"), { overdue: false, installments: [{ seq: 1, overdue: false }, { seq: 2, overdue: false }] });
    eq(evaluateOverdue(inst, 7, "2027-03-09"), { overdue: true, installments: [{ seq: 1, overdue: false }, { seq: 2, overdue: true }] });
  });

});
