import { auditLog } from "@workspace/db/schema";
import type { Tx } from "./types";

export async function writeAudit(
  tx: Tx,
  e: { actor: string | null; action: string; entityType: string; entityId: string; before?: unknown; after?: unknown; reason?: string },
) {
  await tx.insert(auditLog).values({
    actorUserId: e.actor,
    action: e.action,
    entityType: e.entityType,
    entityId: e.entityId,
    beforeData: e.before ?? null,
    afterData: e.after ?? null,
    reason: e.reason ?? null,
  });
}

/** True when a Postgres error (possibly wrapped by Drizzle) is the named constraint, by SQLSTATE and name. */
export function isConstraintError(err: unknown, constraint: string, sqlstate?: string): boolean {
  const e = err as { code?: string; constraint_name?: string; constraint?: string; message?: string; cause?: unknown };
  const inner = (e.cause ?? {}) as { code?: string; constraint?: string; constraint_name?: string; message?: string };
  const code = e.code ?? inner.code;
  const name = e.constraint_name ?? e.constraint ?? inner.constraint_name ?? inner.constraint;
  const text = `${e.message ?? ""} ${inner.message ?? ""}`;
  return (!sqlstate || code === sqlstate) && (name === constraint || text.includes(constraint));
}
