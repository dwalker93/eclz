import { expect } from "bun:test";
import { ServiceError, type ServiceErrorCode } from "../src";

/** Compares by JSON, so a Date and its ISO string are not told apart. */
export function eq<T>(actual: T, expected: T, what = "value") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
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
