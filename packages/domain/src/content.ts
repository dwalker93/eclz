import { and, asc, eq, inArray, isNull, sql } from "drizzle-orm";
import {
  branch,
  contentBranch,
  contentItem,
  contentPurchase,
  course,
  courseContent,
  courseSection,
  enrollment,
  file,
  invoice,
  invoiceItem,
  lecturer,
  paymentAllocation,
  student,
  studentBranch,
} from "@workspace/db/schema";
import { fromCents, toCents } from "@workspace/db/money";
import { accessState } from "./access";
import { isConstraintError } from "./audit";
import { addDays } from "./dates";
import { insertInvoice } from "./invoicing";
import { todayFor } from "./lookups";
import { gateModule } from "./authorization";
import { ServiceError } from "./errors";
import { type VerifiedEvent, type VoidedEvent } from "./payments";
import { type Db, type Tx } from "./types";

type ItemRow = typeof contentItem.$inferSelect;
type PurchaseRow = typeof contentPurchase.$inferSelect;

export type ContentKind = "recording" | "file" | "physical_book";
export type ContentAccessType = "course" | "free_registered" | "paid";
export type AccessVia = "purchase" | "course" | "free_registered";
export type ContentDenial = "not_viewable" | "not_published" | "no_access";

/**
 * F3, F4: the one place that decides whether a student can open an item. A paid purchase is permanent and wins (even if the item was archived
 * later); otherwise the item must be published and reachable through a course the student effectively has access to, or be free for registered
 * students of a branch it is listed in. A physical book has nothing to open.
 */
export function decideContentAccess(i: {
  kind: ContentKind;
  status: string;
  purchasePaid: boolean;
  viaCourse: boolean;
  freeInStudentBranch: boolean;
}): { allowed: true; via: AccessVia } | { allowed: false; reason: ContentDenial } {
  if (i.kind === "physical_book") return { allowed: false, reason: "not_viewable" };
  if (i.purchasePaid) return { allowed: true, via: "purchase" };
  if (i.status !== "published") return { allowed: false, reason: "not_published" };
  if (i.viaCourse) return { allowed: true, via: "course" };
  if (i.freeInStudentBranch) return { allowed: true, via: "free_registered" };
  return { allowed: false, reason: "no_access" };
}

function checkUrl(url: string) {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:" && u.protocol !== "http:") throw new Error();
  } catch {
    throw new ServiceError("content_invalid", "The link must be a web address (https://...).");
  }
}

function buildContentService(db: Db, opts: { now?: () => Date } = {}) {
  const now = () => (opts.now ?? (() => new Date()))();

  async function loadItem(tx: Tx, contentId: string, lock = false): Promise<ItemRow> {
    const q = tx.select().from(contentItem).where(eq(contentItem.id, contentId));
    const [row] = await (lock ? q.for("update") : q);
    if (!row) throw new ServiceError("not_found", "Content not found.");
    return row;
  }

  async function listedBranches(tx: Tx, contentId: string): Promise<string[]> {
    return (await tx.select({ id: contentBranch.branchId }).from(contentBranch).where(eq(contentBranch.contentId, contentId)).orderBy(asc(contentBranch.branchId))).map((r) => r.id);
  }

  /** Everything F3 needs for one student and one item. */
  async function accessFor(tx: Tx, studentId: string, item: ItemRow, today: string) {
    const [paid] = await tx.select({ id: contentPurchase.id }).from(contentPurchase).where(and(eq(contentPurchase.contentId, item.id), eq(contentPurchase.studentId, studentId), eq(contentPurchase.status, "paid")));
    const attached = (await tx.select({ id: courseContent.courseId }).from(courseContent).where(eq(courseContent.contentId, item.id))).map((c) => c.id);
    let viaCourse = false;
    if (attached.length) {
      const enrols = await tx.select().from(enrollment).where(and(eq(enrollment.studentId, studentId), inArray(enrollment.courseId, attached)));
      viaCourse = enrols.some((e) => accessState(e, today).allowed);
    }
    let free = false;
    if (item.accessType === "free_registered") {
      const mine = (await tx.select({ id: studentBranch.branchId }).from(studentBranch).where(eq(studentBranch.studentId, studentId))).map((b) => b.id);
      const listed = await listedBranches(tx, item.id);
      free = listed.some((b) => mine.includes(b));
    }
    return decideContentAccess({ kind: item.kind as ContentKind, status: item.status, purchasePaid: !!paid, viaCourse, freeInStudentBranch: free });
  }

  return {
    // ---- items

    /**
     * Creates a draft item (F1, F2). A recording needs a web link and no file, a file needs an uploaded file, a physical book has neither and can
     * only be sold (paid). Only a paid item has a price, and it must be above zero. Paid and free-for-registered items must be listed in at least one branch.
     */
    async createItem(input: {
      lecturerId: string;
      kind: ContentKind;
      title: string;
      description?: string;
      externalUrl?: string;
      fileId?: string;
      accessType?: ContentAccessType;
      price?: string | number;
      branchIds?: string[];
    }) {
      const accessType = input.accessType ?? "course";
      if (!input.title?.trim()) throw new ServiceError("content_invalid", "The title is required.");
      if (input.kind === "recording") {
        if (!input.externalUrl || input.fileId) throw new ServiceError("content_invalid", "A recording needs a link and no file.");
        checkUrl(input.externalUrl);
      } else if (input.kind === "file") {
        if (!input.fileId || input.externalUrl) throw new ServiceError("content_invalid", "A file item needs an uploaded file and no link.");
      } else if (input.kind === "physical_book") {
        if (input.fileId || input.externalUrl) throw new ServiceError("content_invalid", "A physical book has no link or file.");
        if (accessType !== "paid") throw new ServiceError("content_invalid", "A physical book can only be sold (paid).");
      } else throw new ServiceError("content_invalid", `Unknown kind: ${String(input.kind)}`);
      if (accessType === "paid") {
        if (input.price === undefined || !(Number(input.price) > 0)) throw new ServiceError("content_invalid", "A paid item needs a price above zero.");
      } else if (input.price !== undefined) {
        throw new ServiceError("content_invalid", "Only a paid item has a price.");
      }
      const branchIds = [...new Set(input.branchIds ?? [])];
      if (accessType !== "course" && branchIds.length === 0) throw new ServiceError("content_invalid", "List the item in at least one branch.");
      return db.transaction(async (tx) => {
        const [l] = await tx.select({ id: lecturer.id }).from(lecturer).where(eq(lecturer.id, input.lecturerId));
        if (!l) throw new ServiceError("not_found", "Lecturer not found.");
        if (input.fileId) {
          const [f] = await tx.select({ id: file.id }).from(file).where(eq(file.id, input.fileId));
          if (!f) throw new ServiceError("not_found", "File not found.");
        }
        if (branchIds.length) {
          const found = await tx.select({ id: branch.id }).from(branch).where(inArray(branch.id, branchIds));
          if (found.length !== branchIds.length) throw new ServiceError("not_found", "A branch was not found.");
        }
        const [row] = await tx
          .insert(contentItem)
          .values({
            lecturerId: input.lecturerId,
            kind: input.kind,
            title: input.title.trim(),
            description: input.description ?? null,
            externalUrl: input.externalUrl ?? null,
            fileId: input.fileId ?? null,
            accessType,
            price: input.price === undefined ? null : fromCents(toCents(input.price)),
          })
          .returning();
        if (branchIds.length) await tx.insert(contentBranch).values(branchIds.map((branchId) => ({ contentId: row!.id, branchId })));
        return row!;
      });
    },

    /** Lists an item in more branches. Existing listings stay (purchases refer to them). */
    async addBranches(input: { contentId: string; branchIds: string[] }) {
      return db.transaction(async (tx) => {
        await loadItem(tx, input.contentId, true);
        const found = await tx.select({ id: branch.id }).from(branch).where(inArray(branch.id, input.branchIds));
        if (found.length !== new Set(input.branchIds).size) throw new ServiceError("not_found", "A branch was not found.");
        await tx.insert(contentBranch).values([...new Set(input.branchIds)].map((branchId) => ({ contentId: input.contentId, branchId }))).onConflictDoNothing();
        return listedBranches(tx, input.contentId);
      });
    },

    /** Changes the text, and the price of a paid item. A new price applies to later purchases only; each purchase keeps the price it was bought at. */
    async updateItem(input: { contentId: string; title?: string; description?: string | null; price?: string | number }) {
      return db.transaction(async (tx) => {
        const item = await loadItem(tx, input.contentId, true);
        const set: Partial<typeof contentItem.$inferInsert> = {};
        if (input.title !== undefined) {
          if (!input.title.trim()) throw new ServiceError("content_invalid", "The title is required.");
          set.title = input.title.trim();
        }
        if (input.description !== undefined) set.description = input.description;
        if (input.price !== undefined) {
          if (item.accessType !== "paid") throw new ServiceError("content_invalid", "Only a paid item has a price.");
          if (!(Number(input.price) > 0)) throw new ServiceError("content_invalid", "A paid item needs a price above zero.");
          set.price = fromCents(toCents(input.price));
        }
        if (Object.keys(set).length === 0) return item;
        const [row] = await tx.update(contentItem).set(set).where(eq(contentItem.id, item.id)).returning();
        return row!;
      });
    },

    /** draft -> published, published -> archived, archived -> published. Archiving hides the item from the store and from course and free access; paid owners keep it (F4). */
    async setStatus(input: { contentId: string; status: "published" | "archived" }) {
      return db.transaction(async (tx) => {
        const item = await loadItem(tx, input.contentId, true);
        const ok = (item.status === "draft" && input.status === "published") || (item.status === "published" && input.status === "archived") || (item.status === "archived" && input.status === "published");
        if (!ok) throw new ServiceError("content_invalid", `Cannot move content from ${item.status} to ${input.status}.`);
        const [row] = await tx.update(contentItem).set({ status: input.status }).where(eq(contentItem.id, item.id)).returning();
        return row!;
      });
    },

    // ---- courses

    async createSection(input: { courseId: string; title: string; position?: number }) {
      if (!input.title?.trim()) throw new ServiceError("content_invalid", "The section needs a title.");
      return db.transaction(async (tx) => {
        const [c] = await tx.select({ id: course.id }).from(course).where(eq(course.id, input.courseId));
        if (!c) throw new ServiceError("not_found", "Course not found.");
        const [row] = await tx.insert(courseSection).values({ courseId: c.id, title: input.title.trim(), position: input.position ?? 0 }).returning();
        return row!;
      });
    },

    /** Puts an item in a course (optionally in one of its sections). Students with effective access in the course can open it (F3a). Attaching again changes only what the caller supplies: a new position keeps the section, a new section keeps the position, and `sectionId: null` takes the item out of its section. */
    async attachToCourse(input: { courseId: string; contentId: string; sectionId?: string | null; position?: number }) {
      return db.transaction(async (tx) => {
        const [c] = await tx.select({ id: course.id }).from(course).where(eq(course.id, input.courseId));
        if (!c) throw new ServiceError("not_found", "Course not found.");
        await loadItem(tx, input.contentId);
        if (input.sectionId) {
          const [sec] = await tx.select().from(courseSection).where(and(eq(courseSection.id, input.sectionId), eq(courseSection.courseId, c.id)));
          if (!sec) throw new ServiceError("content_invalid", "That section does not belong to this course.");
        }
        const [row] = await tx
          .insert(courseContent)
          .values({ courseId: c.id, contentId: input.contentId, sectionId: input.sectionId ?? null, position: input.position ?? 0 })
          // Only the supplied fields change; an attach with nothing new is a no-op update that still returns the row.
          .onConflictDoUpdate({
            target: [courseContent.courseId, courseContent.contentId],
            set: {
              ...(input.sectionId !== undefined ? { sectionId: input.sectionId } : {}),
              ...(input.position !== undefined ? { position: input.position } : {}),
              ...(input.sectionId === undefined && input.position === undefined ? { courseId: c.id } : {}),
            },
          })
          .returning();
        return row!;
      });
    },

    async detachFromCourse(input: { courseId: string; contentId: string }) {
      const rows = await db.delete(courseContent).where(and(eq(courseContent.courseId, input.courseId), eq(courseContent.contentId, input.contentId))).returning({ id: courseContent.id });
      return rows.length;
    },

    // ---- viewing (F3)

    /** The decision for one student and one item, with the way in or the reason it is closed. */
    async canViewContent(input: { studentId: string; contentId: string }) {
      return db.transaction(async (tx) => {
        const item = await loadItem(tx, input.contentId);
        return accessFor(tx, input.studentId, item, await todayFor(tx, now()));
      });
    },

    /** Opens an item: returns the link or file id only when F3 allows it, otherwise `content_not_accessible`. */
    async openContent(input: { studentId: string; contentId: string }) {
      return db.transaction(async (tx) => {
        const item = await loadItem(tx, input.contentId);
        const d = await accessFor(tx, input.studentId, item, await todayFor(tx, now()));
        if (!d.allowed) throw new ServiceError("content_not_accessible", "You do not have access to this item.");
        return { id: item.id, kind: item.kind as ContentKind, title: item.title, description: item.description, externalUrl: item.externalUrl, fileId: item.fileId, via: d.via };
      });
    },

    /**
     * What a student's library screen needs: `available` (items they can open now and how), `store` (paid items on sale in their branches that they
     * have not bought) and `purchases` (their pending and paid purchases). No links or files are returned here, use `openContent`.
     */
    async listForStudent(input: { studentId: string }) {
      return db.transaction(async (tx) => {
        const today = await todayFor(tx, now());
        const [stu] = await tx.select().from(student).where(eq(student.id, input.studentId));
        if (!stu) throw new ServiceError("not_found", "Student not found.");
        const mine = (await tx.select({ id: studentBranch.branchId }).from(studentBranch).where(eq(studentBranch.studentId, stu.id))).map((b) => b.id);
        const enrols = await tx.select().from(enrollment).where(eq(enrollment.studentId, stu.id));
        const courseIds = enrols.filter((e) => accessState(e, today).allowed).map((e) => e.courseId);
        const purchases = await tx.select().from(contentPurchase).where(and(eq(contentPurchase.studentId, stu.id), inArray(contentPurchase.status, ["pending", "paid"]))).orderBy(asc(contentPurchase.purchasedAt), asc(contentPurchase.id));

        const candidates = new Map<string, ItemRow>();
        const add = (rows: ItemRow[]) => rows.forEach((r) => candidates.set(r.id, r));
        if (courseIds.length) {
          const rows = await tx.select({ i: contentItem }).from(courseContent).innerJoin(contentItem, eq(contentItem.id, courseContent.contentId)).where(inArray(courseContent.courseId, courseIds));
          add(rows.map((r) => r.i));
        }
        if (mine.length) {
          const rows = await tx.selectDistinct({ i: contentItem }).from(contentBranch).innerJoin(contentItem, eq(contentItem.id, contentBranch.contentId)).where(and(inArray(contentBranch.branchId, mine), eq(contentItem.status, "published")));
          add(rows.map((r) => r.i));
        }
        const paidIds = purchases.filter((p) => p.status === "paid").map((p) => p.contentId);
        if (paidIds.length) add(await tx.select().from(contentItem).where(inArray(contentItem.id, paidIds)));

        const available: { contentId: string; title: string; kind: ContentKind; via: AccessVia }[] = [];
        const store: { contentId: string; title: string; kind: ContentKind; price: string; branchIds: string[] }[] = [];
        const bought = new Set(purchases.map((p) => p.contentId));
        for (const item of [...candidates.values()].sort((a, b) => a.title.localeCompare(b.title) || a.id.localeCompare(b.id))) {
          const d = await accessFor(tx, stu.id, item, today);
          if (d.allowed) available.push({ contentId: item.id, title: item.title, kind: item.kind as ContentKind, via: d.via });
          else if (item.accessType === "paid" && item.status === "published" && !bought.has(item.id)) {
            const listed = (await listedBranches(tx, item.id)).filter((b) => mine.includes(b));
            if (listed.length) store.push({ contentId: item.id, title: item.title, kind: item.kind as ContentKind, price: item.price!, branchIds: listed });
          }
        }
        return { available, store, purchases };
      });
    },

    /** The items of a course in section and position order, with whether this student can open each one. */
    async listCourseContent(input: { courseId: string; studentId: string }) {
      return db.transaction(async (tx) => {
        const today = await todayFor(tx, now());
        const rows = await tx
          .select({ cc: courseContent, i: contentItem, sectionTitle: courseSection.title, sectionPos: courseSection.position })
          .from(courseContent)
          .innerJoin(contentItem, eq(contentItem.id, courseContent.contentId))
          .leftJoin(courseSection, eq(courseSection.id, courseContent.sectionId))
          .where(eq(courseContent.courseId, input.courseId))
          .orderBy(asc(sql`coalesce(${courseSection.position}, -1)`), asc(courseContent.position), asc(courseContent.id));
        const out = [];
        for (const r of rows) {
          if (r.i.status === "draft") continue;
          const d = await accessFor(tx, input.studentId, r.i, today);
          out.push({ contentId: r.i.id, title: r.i.title, kind: r.i.kind as ContentKind, section: r.sectionTitle, canOpen: d.allowed });
        }
        return out;
      });
    },

    // ---- purchases (F4, F5, F6)

    /**
     * Buys a paid item: creates a pending purchase and its invoice (one content line, D13) in one transaction. The price is copied onto the purchase.
     * Digital items use channel `online`, physical books `physical`. The branch must be one the item is listed in (given, else the student's primary
     * branch if listed, else the only listed branch). A student with a pending purchase of the same item gets that one back; with a paid one, `already_purchased` (F5).
     * Pay it like any invoice; the purchase turns `paid` when the invoice is fully paid (see `hooks`).
     */
    async purchase(input: { contentId: string; studentId: string; branchId?: string; dueAfterDays?: number }) {
      try {
        return await db.transaction(async (tx) => {
          const item = await loadItem(tx, input.contentId, true);
          if (item.accessType !== "paid" || item.status !== "published") throw new ServiceError("content_invalid", "This item is not on sale.");
          const [stu] = await tx.select().from(student).where(eq(student.id, input.studentId));
          if (!stu) throw new ServiceError("not_found", "Student not found.");
          if (stu.status !== "active") throw new ServiceError("student_not_eligible", "The student is not active.");

          const [existing] = await tx.select().from(contentPurchase).where(and(eq(contentPurchase.contentId, item.id), eq(contentPurchase.studentId, stu.id), inArray(contentPurchase.status, ["pending", "paid"])));
          if (existing?.status === "paid") throw new ServiceError("already_purchased", "This item is already bought.");
          if (existing) return { purchase: existing, invoiceId: existing.invoiceId!, existing: true };

          const listed = await listedBranches(tx, item.id);
          let branchId = input.branchId;
          if (branchId) {
            if (!listed.includes(branchId)) throw new ServiceError("content_invalid", "The item is not listed in that branch.");
          } else {
            const mine = await tx.select().from(studentBranch).where(eq(studentBranch.studentId, stu.id));
            const primary = mine.find((m) => m.isPrimary && listed.includes(m.branchId));
            const common = listed.filter((b) => mine.some((m) => m.branchId === b));
            branchId = primary?.branchId ?? (common.length === 1 ? common[0] : listed.length === 1 ? listed[0] : undefined);
            if (!branchId) throw new ServiceError("content_invalid", "Choose the branch to buy from.");
          }

          const today = await todayFor(tx, now());
          const channel = item.kind === "physical_book" ? "physical" : "online";
          const [p] = await tx.insert(contentPurchase).values({ contentId: item.id, studentId: stu.id, branchId, channel, price: item.price!, purchasedAt: now() }).returning();
          const { invoice: inv } = await insertInvoice(tx, {
            studentId: stu.id,
            branchId,
            issuedOn: today,
            dueDate: addDays(today, input.dueAfterDays ?? 7),
            items: [{ kind: "content", cents: toCents(item.price!), description: item.title, contentPurchaseId: p!.id }],
            afterHeader: async (invoiceId) => {
              await tx.update(contentPurchase).set({ invoiceId }).where(eq(contentPurchase.id, p!.id));
            },
          });
          return { purchase: { ...p!, invoiceId: inv.id }, invoiceId: inv.id, existing: false };
        });
      } catch (err) {
        if (isConstraintError(err, "content_purchase_active_uq")) throw new ServiceError("already_purchased", "A purchase of this item was just started.");
        throw err;
      }
    },

    /** Cancels a pending purchase and its unpaid invoice. Refused once any payment is allocated to the invoice (adjust or void it instead). */
    async cancelPurchase(input: { purchaseId: string }): Promise<typeof contentPurchase.$inferSelect> {
      // Lock order is invoice, then purchase, the same as a payment verification (it locks the invoice in loadOpenItems, then updates the purchase
      // in its hook), so the two cannot wait for each other. The invoice id comes from an unlocked read and is checked again under both locks.
      for (let attempt = 0; attempt < 3; attempt++) {
        const [peek] = await db.select({ invoiceId: contentPurchase.invoiceId }).from(contentPurchase).where(eq(contentPurchase.id, input.purchaseId));
        if (!peek) throw new ServiceError("not_found", "Purchase not found.");
        const done = await db.transaction(async (tx) => {
          if (peek.invoiceId) await tx.select({ id: invoice.id }).from(invoice).where(eq(invoice.id, peek.invoiceId)).for("update");
          const [p] = await tx.select().from(contentPurchase).where(eq(contentPurchase.id, input.purchaseId)).for("update");
          if (!p) throw new ServiceError("not_found", "Purchase not found.");
          // The purchase got (or lost) its invoice since the first read: the locks held are the wrong ones, so look again.
          if (p.invoiceId !== peek.invoiceId) return null;
          if (p.status === "cancelled") return p;
          if (p.status === "paid") throw new ServiceError("content_invalid", "A paid purchase cannot be cancelled.");
          if (p.invoiceId) {
            const [n] = await tx.select({ n: sql<number>`count(*)::int` }).from(paymentAllocation).where(and(eq(paymentAllocation.invoiceId, p.invoiceId), isNull(paymentAllocation.reversedAt)));
            if (n!.n > 0) throw new ServiceError("content_invalid", "Payments are already allocated to this purchase.");
            await tx.update(invoiceItem).set({ cancelledAt: now() }).where(and(eq(invoiceItem.invoiceId, p.invoiceId), isNull(invoiceItem.cancelledAt)));
            await tx.update(invoice).set({ status: "cancelled" }).where(eq(invoice.id, p.invoiceId));
          }
          const [row] = await tx.update(contentPurchase).set({ status: "cancelled" }).where(eq(contentPurchase.id, p.id)).returning();
          return row!;
        });
        if (done) return done;
      }
      throw new ServiceError("content_invalid", "The purchase kept changing; try again.");
    },

    /** F6: records that a paid physical item was handed over, and who did it. Payment and handover are separate events. */
    async handOver(input: { purchaseId: string; handedOverBy: string }) {
      return db.transaction(async (tx) => {
        const [p] = await tx.select().from(contentPurchase).where(eq(contentPurchase.id, input.purchaseId)).for("update");
        if (!p) throw new ServiceError("not_found", "Purchase not found.");
        if (p.channel !== "physical") throw new ServiceError("content_invalid", "Only a physical item is handed over.");
        if (p.status !== "paid") throw new ServiceError("purchase_not_paid", "Hand over only after payment.");
        if (p.handedOverAt) throw new ServiceError("already_handed_over", "This item was already handed over.");
        const [row] = await tx.update(contentPurchase).set({ handedOverAt: now(), handedOverBy: input.handedOverBy }).where(eq(contentPurchase.id, p.id)).returning();
        return row!;
      });
    },

    /** Paid physical purchases still waiting to be handed over, oldest first, optionally for one branch or a set of branches (an empty set matches nothing). */
    async pendingHandovers(input: { branchId?: string; branchIds?: string[] } = {}) {
      if (input.branchIds && input.branchIds.length === 0) return [];
      return db
        .select({ purchase: contentPurchase, title: contentItem.title, studentName: student.fullName, studentNo: student.studentNo })
        .from(contentPurchase)
        .innerJoin(contentItem, eq(contentItem.id, contentPurchase.contentId))
        .innerJoin(student, eq(student.id, contentPurchase.studentId))
        .where(and(eq(contentPurchase.status, "paid"), eq(contentPurchase.channel, "physical"), isNull(contentPurchase.handedOverAt), input.branchId ? eq(contentPurchase.branchId, input.branchId) : undefined, input.branchIds ? inArray(contentPurchase.branchId, input.branchIds) : undefined))
        .orderBy(asc(contentPurchase.purchasedAt), asc(contentPurchase.id));
    },

    /**
     * Pass as part of `hooks` to createPaymentService (join it with the others using `combineHooks`). After a verification, a pending purchase whose
     * invoice is now fully paid becomes `paid` (F4: it grants permanent access). After a void, a paid purchase whose invoice is no longer fully paid
     * goes back to `pending`, unless a physical item was already handed over (that record is kept for staff to resolve).
     */
    hooks: {
      afterVerify: async (tx: Tx, event: VerifiedEvent) => {
        const invoiceIds = [...new Set(event.allocations.map((a) => a.invoiceId))].sort();
        if (!invoiceIds.length) return;
        const paidInvoices = (await tx.select({ id: invoice.id }).from(invoice).where(and(inArray(invoice.id, invoiceIds), eq(invoice.status, "paid")))).map((r) => r.id);
        if (!paidInvoices.length) return;
        await tx.update(contentPurchase).set({ status: "paid" }).where(and(inArray(contentPurchase.invoiceId, paidInvoices), eq(contentPurchase.status, "pending")));
      },
      afterVoid: async (tx: Tx, event: VoidedEvent) => {
        const invoiceIds = [...new Set(event.reversedAllocations.map((a) => a.invoiceId))].sort();
        if (!invoiceIds.length) return;
        const stillPaid = (await tx.select({ id: invoice.id }).from(invoice).where(and(inArray(invoice.id, invoiceIds), eq(invoice.status, "paid")))).map((r) => r.id);
        const reopen = invoiceIds.filter((id) => !stillPaid.includes(id));
        if (!reopen.length) return;
        await tx.update(contentPurchase).set({ status: "pending" }).where(and(inArray(contentPurchase.invoiceId, reopen), eq(contentPurchase.status, "paid"), isNull(contentPurchase.handedOverAt)));
      },
    },
  };
}
/** K: every content action needs the content_store module. Payment hooks pass through so money already taken still settles. */
export function createContentService(db: Db, opts: { now?: () => Date } = {}) {
  return gateModule(db, "content_store", buildContentService(db, opts));
}
export type ContentService = ReturnType<typeof buildContentService>;
