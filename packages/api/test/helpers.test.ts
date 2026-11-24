import { describe, expect, test } from "bun:test";
import { eq } from "./helpers";

describe("eq", () => {
  test("a missing value is not null, in arrays or objects", () => {
    expect(() => eq([200, undefined], [200, null])).toThrow();
    expect(() => eq({ restriction: undefined } as object, { restriction: null } as object)).toThrow();
    expect(() => eq({ a: undefined } as object, {} as object)).toThrow();
  });
  test("explicit nulls and a Date against its ISO string still match", () => {
    eq([200, null], [200, null]);
    eq(new Date("2027-01-01T00:00:00Z") as unknown, "2027-01-01T00:00:00.000Z" as unknown);
  });
});
