/**
 * Pure commission helpers: rule matching and share splitting. No database.
 */
import { describe, test } from "bun:test";
import * as schema from "@workspace/db/schema";
import {
  pickRule,
  splitByShare,
} from "../src";
import { eq } from "./helpers";

describe("commission rule matching and share split (pure functions)", () => {

  type RuleRow = typeof schema.commissionRule.$inferSelect;

  const rule = (o: Partial<RuleRow> & { id: string }): RuleRow =>
    ({ lecturerId: "L", subjectId: null, gradeLevelId: null, courseId: null, calcType: "percent", commissionRate: "10.00", effectiveFrom: "2020-01-01", effectiveTo: null, createdAt: new Date(), ...o }) as RuleRow;

  test("H4: the most specific rule in effect wins", async () => {
    const ctx = { courseId: "C", subjectId: "S", gradeLevelId: "G", date: "2027-03-10" };
    const rules = [
      rule({ id: "default" }),
      rule({ id: "subject", subjectId: "S" }),
      rule({ id: "subjectGrade", subjectId: "S", gradeLevelId: "G" }),
      rule({ id: "course", courseId: "C" }),
    ];
    eq(pickRule(rules, ctx)?.id, "course");
    eq(pickRule(rules.filter((r) => r.id !== "course"), ctx)?.id, "subjectGrade");
    eq(pickRule(rules.filter((r) => !["course", "subjectGrade"].includes(r.id)), ctx)?.id, "subject");
    eq(pickRule([rule({ id: "default" })], ctx)?.id, "default");
    eq(pickRule([rule({ id: "other", subjectId: "X" }), rule({ id: "othergrade", subjectId: "S", gradeLevelId: "H" })], ctx), null);
    eq(pickRule([rule({ id: "ended", effectiveTo: "2027-03-10" }), rule({ id: "future", effectiveFrom: "2027-03-11" })], ctx), null);
  });

  test("splitByShare adds back exactly", async () => {
    eq(splitByShare(10001, [50, 50]), [5001, 5000]);
    eq(splitByShare(10000, [60, 40]), [6000, 4000]);
    eq(splitByShare(100, [34, 33, 33]).reduce((s, x) => s + x, 0), 100);
    eq(splitByShare(500, [100]), [500]);
  });

});
