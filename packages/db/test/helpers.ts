import { expect } from "bun:test";

/** Compares by JSON, so a Date and its ISO string are not told apart and key order does not matter for arrays of scalars. */
export function eq<T>(actual: T, expected: T, what = "value") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) {
    throw new Error(`${what}: expected ${JSON.stringify(expected)} but got ${JSON.stringify(actual)}`);
  }
}

/** Passes when `fn` fails with a database error whose message (or cause) matches `pattern`, for example a constraint name. */
export async function rejects(pattern: RegExp, fn: () => Promise<unknown>) {
  try {
    await fn();
  } catch (e) {
    const err = e as Error & { cause?: { message?: string } };
    expect(`${err.message} ${err.cause?.message ?? ""}`).toMatch(pattern);
    return;
  }
  throw new Error("expected an error but it succeeded");
}
