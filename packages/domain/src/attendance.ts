import { and, asc, eq, inArray, isNull, or, gt, lte, sql } from "drizzle-orm";
import { attendance, classSession, course, enrollment, student } from "@workspace/db/schema";
import { canonicalUuid, requireModule } from "./authorization";
import { isCalendarDay, normalizeClockTime } from "./dates";
import { loadOrganization, todayFor } from "./lookups";
import { queueNotifications, resolveGuardianRecipients } from "./notifications";
import { ServiceError } from "./errors";
import { type Db, type Tx } from "./types";

export type AttendanceStatus = "present" | "absent" | "late" | "excused";
type SessionRow = typeof classSession.$inferSelect;
type OrgRow = Awaited<ReturnType<typeof loadOrganization>>;

const STATUSES: AttendanceStatus[] = ["present", "absent", "late", "excused"];
const attended = (s: AttendanceStatus) => s === "present" || s === "late";

export interface MarkEntry {
  studentId: string;
  status: AttendanceStatus;
  /** Where the student attended. Needed for present or late in a hybrid session unless the enrolment has a preferred mode. */
  attendedVia?: "physical" | "online";
  note?: string;
}

/** Share of sessions attended: present and late count, excused sessions are left out of both sides. Null when nothing counts yet. */
export function attendanceRate(counts: { present: number; late: number; absent: number; excused: number }): number | null {
  const base = counts.present + counts.late + counts.absent;
  return base === 0 ? null : Math.round(((counts.present + counts.late) / base) * 1000) / 10;
}

export function createAttendanceService(db: Db, opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();

  async function loadSession(tx: Tx, sessionId: string, lock = false): Promise<SessionRow> {
    const q = tx.select().from(classSession).where(eq(classSession.id, sessionId));
    const [s] = await (lock ? q.for("update") : q);
    if (!s) throw new ServiceError("not_found", "Session not found.");
    return s;
  }

  /** Enrolments that count for a session: active, in their access window on the session date, and in the session's intake when it has one. */
  async function enrolled(tx: Tx, s: SessionRow, studentIds?: string[]) {
    return tx
      .select({ enr: enrollment, name: student.fullName, studentNo: student.studentNo })
      .from(enrollment)
      .innerJoin(student, eq(student.id, enrollment.studentId))
      .where(
        and(
          eq(enrollment.courseId, s.courseId),
          eq(enrollment.status, "active"),
          lte(enrollment.accessStartsOn, s.sessionDate),
          or(isNull(enrollment.accessEndsOn), gt(enrollment.accessEndsOn, s.sessionDate)),
          s.intakeId ? eq(enrollment.intakeId, s.intakeId) : undefined,
          studentIds ? inArray(enrollment.studentId, studentIds) : undefined,
        ),
      )
      .orderBy(asc(student.fullName), asc(student.id));
  }

  function openForMarking(s: SessionRow, today: string) {
    if (s.status === "cancelled") throw new ServiceError("session_not_open", "The session is cancelled.");
    if (s.sessionDate > today) throw new ServiceError("session_in_future", "Attendance cannot be marked before the session day.");
  }

  function resolveVia(s: SessionRow, e: MarkEntry, preferred: string | null): "physical" | "online" | null {
    if (!attended(e.status)) return null;
    if (e.attendedVia) return e.attendedVia;
    if (s.deliveryMode === "physical" || s.deliveryMode === "online") return s.deliveryMode;
    if (preferred === "physical" || preferred === "online") return preferred;
    throw new ServiceError("invalid_input", "Say whether the student attended physically or online (hybrid session).");
  }

  async function notifyAbsence(tx: Tx, org: OrgRow, s: SessionRow, courseName: string, studentId: string) {
    const { userIds, studentName } = await resolveGuardianRecipients(tx, org, studentId);
    return queueNotifications(tx, org, {
      event: "attendance_marked",
      userIds,
      items: [{ eventKey: `att:${s.id}:${studentId}:absent`, payload: { studentName, courseName, sessionDate: s.sessionDate, sessionId: s.id } }],
      at: now(),
    });
  }

  async function upsertMark(tx: Tx, org: OrgRow, s: SessionRow, courseName: string, e: MarkEntry, via: "physical" | "online" | null, markedVia: "manual" | "qr", actor: string | null) {
    const [before] = await tx.select().from(attendance).where(and(eq(attendance.sessionId, s.id), eq(attendance.studentId, e.studentId)));
    await tx
      .insert(attendance)
      .values({ sessionId: s.id, studentId: e.studentId, status: e.status, attendedVia: via, markedVia, note: e.note ?? null, markedBy: actor, markedAt: now() })
      .onConflictDoUpdate({
        target: [attendance.sessionId, attendance.studentId],
        set: { status: e.status, attendedVia: via, markedVia, note: e.note ?? null, markedBy: actor, markedAt: now() },
      });
    let notified = 0;
    if (e.status === "absent" && before?.status !== "absent") notified = await notifyAbsence(tx, org, s, courseName, e.studentId);
    return { changed: before?.status !== e.status, notified };
  }

  /**
   * Writes the marks of `entries` in the caller's transaction, which has the session locked and checked open. Every student must be enrolled
   * for the session. Shared by `mark` and `markRemainingAbsent`, so neither depends on `this`.
   */
  async function applyMarks(tx: Tx, s: SessionRow, entries: MarkEntry[], actor: string | null) {
    const ids = entries.map((e) => e.studentId);
    const org = await loadOrganization(tx);
    const [c] = await tx.select().from(course).where(eq(course.id, s.courseId));
    const roster = new Map((await enrolled(tx, s, ids)).map((r) => [r.enr.studentId, r.enr]));
    let changed = 0;
    let notified = 0;
    for (const e of entries) {
      const enr = roster.get(e.studentId);
      if (!enr) throw new ServiceError("student_not_enrolled", "A student is not enrolled for this session.");
      const r = await upsertMark(tx, org, s, c!.name, e, resolveVia(s, e, enr.preferredMode), "manual", actor);
      if (r.changed) changed++;
      notified += r.notified;
    }
    if (s.status !== "held") await tx.update(classSession).set({ status: "held" }).where(eq(classSession.id, s.id));
    return { marked: entries.length, changed, notifications: notified };
  }

  return {
    /** Creates a session. The course must have attendance on, the intake (if any) must belong to the course, and the end must be after the start. */
    async createSession(input: {
      courseId: string;
      sessionDate: string;
      startsAt: string;
      endsAt: string;
      intakeId?: string | null;
      topic?: string;
      deliveryMode?: "physical" | "online" | "hybrid";
      meeting?: { provider: "zoom" | "teams" | "other"; url?: string; ref?: string };
    }) {
      // Both times in one precision before comparing: 09:00 and 09:00:00 are the same instant, and 09:60 is no time at all.
      const startsAt = normalizeClockTime(input.startsAt);
      const endsAt = normalizeClockTime(input.endsAt);
      if (!startsAt || !endsAt || endsAt <= startsAt) {
        throw new ServiceError("session_invalid", "The session must end after it starts, with real times (HH:MM).");
      }
      input = { ...input, startsAt, endsAt };
      return db.transaction(async (tx) => {
        // Locking the course row serializes concurrent calls for it, so the duplicate check below sees a session the other call just created.
        const [c] = await tx.select().from(course).where(eq(course.id, input.courseId)).for("update");
        if (!c) throw new ServiceError("not_found", "Course not found.");
        if (!c.attendanceEnabled) throw new ServiceError("attendance_disabled", "Attendance is switched off for this course.");
        const mode = input.deliveryMode ?? (c.deliveryMode as "physical" | "online" | "hybrid");
        if (input.meeting && mode === "physical") throw new ServiceError("session_invalid", "A physical session has no meeting link.");
        const [dupe] = await tx
          .select({ id: classSession.id })
          .from(classSession)
          .where(and(eq(classSession.courseId, c.id), eq(classSession.sessionDate, input.sessionDate), eq(classSession.startsAt, input.startsAt), sql`${classSession.status} <> 'cancelled'`));
        if (dupe) throw new ServiceError("session_invalid", "A session already exists for this class at that date and time.");
        try {
          const [row] = await tx
            .insert(classSession)
            .values({
              courseId: c.id,
              intakeId: input.intakeId ?? null,
              sessionDate: input.sessionDate,
              startsAt: input.startsAt,
              endsAt: input.endsAt,
              topic: input.topic ?? null,
              deliveryMode: mode,
              meetingProvider: input.meeting?.provider ?? null,
              meetingUrl: input.meeting?.url ?? null,
              meetingRef: input.meeting?.ref ?? null,
            })
            .returning();
          return row!;
        } catch (err) {
          if (String((err as Error)?.message ?? err).includes("class_session_intake_course_fk") || String(((err as { cause?: Error }).cause)?.message ?? "").includes("class_session_intake_course_fk")) {
            throw new ServiceError("session_invalid", "The intake does not belong to this course.");
          }
          throw err;
        }
      });
    },

    /** Cancels a session. A session that already has attendance marked cannot be cancelled. */
    async cancelSession(input: { sessionId: string }) {
      return db.transaction(async (tx) => {
        const s = await loadSession(tx, input.sessionId, true);
        if (s.status === "cancelled") return s;
        const [m] = await tx.select({ id: attendance.id }).from(attendance).where(eq(attendance.sessionId, s.id)).limit(1);
        if (m) throw new ServiceError("session_has_attendance", "Attendance is already marked for this session.");
        const [row] = await tx.update(classSession).set({ status: "cancelled" }).where(eq(classSession.id, s.id)).returning();
        return row!;
      });
    },

    /** Everyone who should be in the session with their mark, if any. Unmarked students have `status: null`. */
    async getRoster(input: { sessionId: string }) {
      return db.transaction(async (tx) => {
        const s = await loadSession(tx, input.sessionId);
        const list = await enrolled(tx, s);
        const marks = await tx.select().from(attendance).where(eq(attendance.sessionId, s.id));
        const byStudent = new Map(marks.map((m) => [m.studentId, m]));
        return {
          session: s,
          students: list.map((r) => {
            const m = byStudent.get(r.enr.studentId);
            return {
              studentId: r.enr.studentId,
              studentNo: r.studentNo,
              name: r.name,
              enrollmentId: r.enr.id,
              restricted: r.enr.accessStatus === "restricted",
              status: (m?.status ?? null) as AttendanceStatus | null,
              attendedVia: m?.attendedVia ?? null,
              note: m?.note ?? null,
            };
          }),
        };
      });
    },

    /**
     * Marks (or corrects) attendance for several students in one transaction. Every student must be enrolled for the session
     * (active, inside the access window on the session day, in the session's intake). The session cannot be cancelled or in the future.
     * A later call overwrites the earlier mark. Marking sets the session to held. A newly absent student's parents get an
     * `attendance_marked` notification (once per session and student, however often the mark is changed).
     */
    async mark(input: { sessionId: string; entries: MarkEntry[]; actor: string | null }) {
      if (input.entries.length === 0) throw new ServiceError("invalid_input", "Nothing to mark.");
      // One spelling per student before the duplicate check and the roster lookup (the database returns ids in lower case).
      input = { ...input, entries: input.entries.map((e) => ({ ...e, studentId: canonicalUuid(e.studentId) })) };
      const ids = input.entries.map((e) => e.studentId);
      if (new Set(ids).size !== ids.length) throw new ServiceError("invalid_input", "A student appears twice.");
      for (const e of input.entries) if (!STATUSES.includes(e.status)) throw new ServiceError("invalid_input", `Unknown status: ${e.status}`);
      return db.transaction(async (tx) => {
        const s = await loadSession(tx, input.sessionId, true);
        openForMarking(s, await todayFor(tx, now()));
        return applyMarks(tx, s, input.entries, input.actor);
      });
    },

    /**
     * Marks the rest of the roster absent after the register was taken: every enrolled student without a mark becomes absent
     * (parents notified). Students already marked are untouched.
     */
    async markRemainingAbsent(input: { sessionId: string; actor: string | null }) {
      // One transaction under the session lock: reading who is unmarked and writing the absences cannot be separated by a QR scan or a manual mark.
      return db.transaction(async (tx) => {
        const s = await loadSession(tx, input.sessionId, true);
        openForMarking(s, await todayFor(tx, now()));
        const list = await enrolled(tx, s);
        const marked = new Set((await tx.select({ studentId: attendance.studentId }).from(attendance).where(eq(attendance.sessionId, s.id))).map((m) => m.studentId));
        const rest = list.filter((r) => !marked.has(r.enr.studentId)).map((r) => ({ studentId: r.enr.studentId, status: "absent" as const }));
        if (rest.length === 0) return { marked: 0, changed: 0, notifications: 0 };
        return applyMarks(tx, s, rest, input.actor);
      });
    },

    /**
     * QR scan (needs the `qr_attendance` module): marks the card's student present, or late with `late: true`. Scanning twice changes nothing;
     * a student marked absent or excused earlier is corrected to present. Returns the student so the marker sees whose card it was.
     */
    async markByQr(input: { sessionId: string; qrToken: string; late?: boolean; actor: string | null }) {
      return db.transaction(async (tx) => {
        const org = await loadOrganization(tx);
        if (((org.enabledModules ?? {}) as Record<string, boolean | undefined>).qr_attendance !== true) {
          throw new ServiceError("module_disabled", "QR attendance is not enabled.");
        }
        const s = await loadSession(tx, input.sessionId, true);
        openForMarking(s, await todayFor(tx, now()));
        const [stu] = await tx.select().from(student).where(eq(student.qrToken, input.qrToken));
        if (!stu || stu.status !== "active") throw new ServiceError("qr_unknown", "This card is not recognised.");
        const [enr] = (await enrolled(tx, s, [stu.id])).map((r) => r.enr);
        if (!enr) throw new ServiceError("student_not_enrolled", `${stu.fullName} is not enrolled for this session.`);
        const [existing] = await tx.select().from(attendance).where(and(eq(attendance.sessionId, s.id), eq(attendance.studentId, stu.id)));
        const status: AttendanceStatus = input.late ? "late" : "present";
        let already = false;
        if (existing && attended(existing.status as AttendanceStatus)) {
          already = true;
        } else {
          const [c] = await tx.select().from(course).where(eq(course.id, s.courseId));
          const via = s.deliveryMode === "online" ? "online" : "physical";
          await upsertMark(tx, org, s, c!.name, { studentId: stu.id, status }, via, "qr", input.actor);
          if (s.status !== "held") await tx.update(classSession).set({ status: "held" }).where(eq(classSession.id, s.id));
        }
        return { studentId: stu.id, studentNo: stu.studentNo, name: stu.fullName, status: already ? (existing!.status as AttendanceStatus) : status, alreadyMarked: already };
      });
    },

    /** Issues a new QR token for a student, for example after a lost card. The old card stops working at once. */
    async rotateQrToken(input: { studentId: string }) {
      // K: issuing a token needs the module as well as scanning one; with it off the current card stays valid.
      await requireModule(db, "qr_attendance");
      const [row] = await db
        .update(student)
        .set({ qrToken: sql`replace(gen_random_uuid()::text, '-', '')` })
        .where(eq(student.id, input.studentId))
        .returning({ qrToken: student.qrToken });
      if (!row) throw new ServiceError("not_found", "Student not found.");
      return row.qrToken;
    },

    /** One student's counts and attendance rate, optionally for one course and a date range (from inclusive, to exclusive). Cancelled sessions are ignored. */
    async studentSummary(input: { studentId: string; courseId?: string; from?: string; to?: string; scope?: "all" | string[] }) {
      for (const d of [input.from, input.to]) if (d !== undefined && !isCalendarDay(d)) throw new ServiceError("invalid_input", "Dates must be real calendar days like 2027-03-31.");
      // Staff pass their attendance.read scope: only sessions of courses in those branches count, and a course outside them is refused.
      // The student and parent portals pass none (the person sees their own whole record).
      const scope = input.scope;
      if (scope !== undefined && scope !== "all") {
        if (input.courseId) {
          const [c] = await db.select({ branchId: course.branchId }).from(course).where(eq(course.id, input.courseId));
          if (!c) throw new ServiceError("not_found", "Course not found.");
          if (!scope.includes(c.branchId)) throw new ServiceError("forbidden", "You do not have the attendance.read permission in that course's branch.");
        }
      }
      const rows = await db
        .select({ status: attendance.status })
        .from(attendance)
        .innerJoin(classSession, eq(classSession.id, attendance.sessionId))
        .innerJoin(course, eq(course.id, classSession.courseId))
        .where(
          and(
            eq(attendance.studentId, input.studentId),
            scope !== undefined && scope !== "all" ? (scope.length ? inArray(course.branchId, scope) : sql`false`) : undefined,
            sql`${classSession.status} <> 'cancelled'`,
            input.courseId ? eq(classSession.courseId, input.courseId) : undefined,
            input.from ? sql`${classSession.sessionDate} >= ${input.from}` : undefined,
            input.to ? sql`${classSession.sessionDate} < ${input.to}` : undefined,
          ),
        );
      const counts = { present: 0, late: 0, absent: 0, excused: 0 };
      for (const r of rows) counts[r.status as AttendanceStatus]++;
      return { ...counts, sessions: rows.length, rate: attendanceRate(counts) };
    },
  };
}
export type AttendanceService = ReturnType<typeof createAttendanceService>;
