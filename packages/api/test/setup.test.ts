import { afterEach, describe, expect, spyOn, test } from "bun:test";
import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { createScenarioDb } from "./setup";

const dirs: string[] = [];
afterEach(() => {
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

/** A migrations folder whose one migration is `sql`. */
function migrationsWith(sql: string) {
  const dir = mkdtempSync(join(tmpdir(), "scenario-"));
  dirs.push(dir);
  mkdirSync(join(dir, "meta"));
  writeFileSync(join(dir, "meta/_journal.json"), JSON.stringify({ entries: [{ tag: "0000_bad" }] }));
  writeFileSync(join(dir, "0000_bad.sql"), sql);
  return dir;
}

/**
 * How many times `PGlite.prototype.close` is called by PGlite itself while one instance starts up (one call in PGlite 0.6.0). The tests below count calls
 * made by createScenarioDb on top of that, so they hold whatever the PGlite version does internally.
 */
async function closesDuringStartup() {
  const spy = spyOn(PGlite.prototype, "close");
  try {
    const p = new PGlite();
    await p.waitReady;
    const n = spy.mock.calls.length;
    await p.close();
    return n;
  } finally {
    spy.mockRestore();
  }
}

describe("createScenarioDb teardown", () => {
  test("a migration that fails closes the database and the original error comes through", async () => {
    const startup = await closesDuringStartup();
    const close = spyOn(PGlite.prototype, "close");
    try {
      await expect(createScenarioDb({ migrationsDir: migrationsWith("THIS IS NOT SQL;") })).rejects.toThrow(/syntax error/i);
      expect(close).toHaveBeenCalledTimes(startup + 1);
    } finally {
      close.mockRestore();
    }
  });

  test("seeding that fails (no tables to seed into) closes the database and keeps the seed error", async () => {
    const startup = await closesDuringStartup();
    const close = spyOn(PGlite.prototype, "close");
    try {
      await expect(createScenarioDb({ migrationsDir: migrationsWith("SELECT 1;") })).rejects.toThrow();
      expect(close).toHaveBeenCalledTimes(startup + 1);
    } finally {
      close.mockRestore();
    }
  });

  test("a failing close does not hide the setup error", async () => {
    const startup = await closesDuringStartup();
    const original = PGlite.prototype.close;
    let calls = 0;
    // PGlite's own startup call goes through; only the close that createScenarioDb makes after the setup error fails.
    const close = spyOn(PGlite.prototype, "close").mockImplementation(function (this: PGlite) {
      return ++calls <= startup ? original.call(this) : Promise.reject(new Error("close failed"));
    });
    try {
      await expect(createScenarioDb({ migrationsDir: migrationsWith("THIS IS NOT SQL;") })).rejects.toThrow(/syntax error/i);
    } finally {
      close.mockRestore();
    }
  });

  test("on success nothing is closed until the caller does it", async () => {
    const startup = await closesDuringStartup();
    const close = spyOn(PGlite.prototype, "close");
    try {
      const t = await createScenarioDb();
      expect(close).toHaveBeenCalledTimes(startup);
      await t.close();
      expect(close).toHaveBeenCalledTimes(startup + 1);
    } finally {
      close.mockRestore();
    }
  });
});
