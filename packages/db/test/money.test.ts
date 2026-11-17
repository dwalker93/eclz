import { describe, test } from "bun:test";
import { fromCents, toCents } from "../src/money";
import { eq } from "./helpers";

describe("money (pure functions)", () => {
  test("toCents and fromCents round trip", () => {
    eq(toCents("1500.00"), 150000);
    eq(toCents("0.5"), 50);
    eq(toCents(12.34), 1234);
    eq(toCents("-3.07"), -307);
    eq(fromCents(150000), "1500.00");
    eq(fromCents(-307), "-3.07");
    eq(fromCents(5), "0.05");
  });
});
