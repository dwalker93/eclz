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

describe("createScenarioDb teardown", () => {
  test("a migration that fails closes the database and the original error comes through", async () => {
    const close = spyOn(PGlite.prototype, "close");
    try {
      await expect(createScenarioDb({ migrationsDir: migrationsWith("THIS IS NOT SQL;") })).rejects.toThrow(/syntax error/i);
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      close.mockRestore();
    }
  });

  test("seeding that fails (no tables to seed into) closes the database and keeps the seed error", async () => {
    const close = spyOn(PGlite.prototype, "close");
    try {
      await expect(createScenarioDb({ migrationsDir: migrationsWith("SELECT 1;") })).rejects.toThrow();
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      close.mockRestore();
    }
  });

  test("a failing close does not hide the setup error", async () => {
    const close = spyOn(PGlite.prototype, "close").mockRejectedValue(new Error("close failed"));
    try {
      await expect(createScenarioDb({ migrationsDir: migrationsWith("THIS IS NOT SQL;") })).rejects.toThrow(/syntax error/i);
    } finally {
      close.mockRestore();
    }
  });

  test("on success nothing is closed until the caller does it", async () => {
    const close = spyOn(PGlite.prototype, "close");
    try {
      const t = await createScenarioDb();
      expect(close).not.toHaveBeenCalled();
      await t.close();
      expect(close).toHaveBeenCalledTimes(1);
    } finally {
      close.mockRestore();
    }
  });
});
