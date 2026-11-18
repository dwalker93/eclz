/**
 * Pure date and amount helpers for billing. Dates are ISO strings (YYYY-MM-DD) and amounts are integer cents.
 * Date ranges are start-inclusive and end-exclusive, as everywhere in the design.
 */

const pad = (n: number) => String(n).padStart(2, "0");

export function parseDay(iso: string): { y: number; m: number; d: number } {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso);
  if (!m) throw new Error(`Invalid date: ${iso}`);
  return { y: Number(m[1]), m: Number(m[2]), d: Number(m[3]) };
}

export function formatDay(y: number, m: number, d: number): string {
  return `${String(y).padStart(4, "0")}-${pad(m)}-${pad(d)}`;
}

export function addDays(iso: string, days: number): string {
  const { y, m, d } = parseDay(iso);
  const t = new Date(Date.UTC(y, m - 1, d + days));
  return formatDay(t.getUTCFullYear(), t.getUTCMonth() + 1, t.getUTCDate());
}

const daysInMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** The day `months` later, clamped to the end of a shorter month. With exclusive ends, 1 March plus 3 months is 1 June. */
export function addMonths(iso: string, months: number): string {
  const { y, m, d } = parseDay(iso);
  const index = y * 12 + (m - 1) + months;
  const ny = Math.floor(index / 12);
  const nm = (index % 12) + 1;
  return formatDay(ny, nm, Math.min(d, daysInMonth(ny, nm)));
}

export const monthStart = (iso: string) => {
  const { y, m } = parseDay(iso);
  return formatDay(y, m, 1);
};

export const nextMonthStart = (iso: string) => addMonths(monthStart(iso), 1);

export interface Period {
  start: string;
  /** Exclusive. */
  end: string;
}

/** Calendar-month periods starting with the month of `from`, for every month whose start is on or before `upToStart`. */
export function monthlyPeriods(from: string, upToStart: string, limit = 1200): Period[] {
  const out: Period[] = [];
  let start = monthStart(from);
  while (start <= upToStart && out.length < limit) {
    const end = nextMonthStart(start);
    out.push({ start, end });
    start = end;
  }
  return out;
}

/** Today's date in a time zone, for example "Asia/Colombo". */
export function localDate(now: Date, timeZone: string): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(now);
  const get = (type: string) => parts.find((p) => p.type === type)!.value;
  return `${get("year")}-${get("month")}-${get("day")}`;
}

/** `pct` percent of `cents`, where pct is a numeric string like "12.50". Rounds half up to the cent. */
export function percentOf(cents: number, pct: string | number): number {
  const m = /^(\d+)(?:\.(\d{1,2}))?$/.exec(typeof pct === "number" ? pct.toFixed(2) : pct.trim());
  if (!m) throw new Error(`Invalid percent: ${String(pct)}`);
  const hundredths = BigInt(m[1]!) * 100n + BigInt((m[2] ?? "").padEnd(2, "0") || "0");
  return Number((BigInt(cents) * hundredths + 5000n) / 10000n);
}

/** Splits `total` cents into `n` near-equal parts, giving the extra cents to the earliest parts. */
export function spreadCents(total: number, n: number): number[] {
  if (n <= 0) throw new Error("n must be positive");
  const base = Math.floor(total / n);
  const extra = total - base * n;
  return Array.from({ length: n }, (_, i) => base + (i < extra ? 1 : 0));
}

export interface ScheduledInstallment {
  seq: number;
  dueDate: string;
  cents: number;
}

/**
 * Installment schedule for an invoice total (D10). A down payment, when set, is installment 1 and is due on the issue date.
 * The rest is spread over the remaining installments. Later installments are due every `intervalDays`.
 */
export function buildInstallmentSchedule(opts: {
  total: number;
  count: number;
  downPaymentPercent: string;
  intervalDays: number;
  issuedOn: string;
}): ScheduledInstallment[] {
  const { total, count, intervalDays, issuedOn } = opts;
  if (count < 2) throw new Error("an installment plan needs at least 2 installments");
  const down = Number(opts.downPaymentPercent) > 0 ? percentOf(total, opts.downPaymentPercent) : 0;
  const amounts = down > 0 ? [down, ...spreadCents(total - down, count - 1)] : spreadCents(total, count);
  if (amounts.some((a) => a <= 0)) throw new Error("the total is too small for this installment plan");
  return amounts.map((cents, i) => ({ seq: i + 1, dueDate: addDays(issuedOn, i * intervalDays), cents }));
}

/** The cents taken off by a discount exception (D19). It never exceeds the item amount. */
export function discountCents(base: number, type: "percent" | "fixed", value: string): number {
  const raw = type === "percent" ? percentOf(base, value) : Math.round(Number(value) * 100);
  return Math.max(Math.min(raw, base), 0);
}

/** D25: spreads `remaining` cents over the unpaid installments, earliest first for extra cents. */
export function respreadInstallments(remaining: number, unpaidCount: number): number[] {
  if (unpaidCount === 0) return [];
  return spreadCents(remaining, unpaidCount);
}

/** Whole years between a date of birth and a day (B2). A birthday counts on its day. */
export function ageOn(dateOfBirth: string, day: string): number {
  const b = parseDay(dateOfBirth);
  const t = parseDay(day);
  let age = t.y - b.y;
  if (t.m < b.m || (t.m === b.m && t.d < b.d)) age--;
  return age;
}
