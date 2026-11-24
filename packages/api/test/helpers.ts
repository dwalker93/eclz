import { expect } from "bun:test";
import { ServiceError, type ServiceErrorCode } from "@workspace/domain";

/** `undefined` is written out, so a missing value and an explicit `null` are different (JSON alone would turn both into `null` in an array and drop the key in an object). */
const show = (v: unknown) => JSON.stringify(v, (_k, x) => (x === undefined ? "__undefined__" : x));

/** Compares by JSON, so a Date and its ISO string are not told apart, but an absent value is never equal to `null`. */
export function eq<T>(actual: T, expected: T, what = "value") {
  if (show(actual) !== show(expected)) {
    throw new Error(`${what}: expected ${show(expected)} but got ${show(actual)}`);
  }
}

/** Passes when `fn` fails with a ServiceError that has this code. Anything else, or no error, fails the test. */
export async function fails(code: ServiceErrorCode, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    expect(e).toBeInstanceOf(ServiceError);
    expect((e as ServiceError).code).toBe(code);
    return;
  }
  throw new Error("expected an error but it succeeded");
}
