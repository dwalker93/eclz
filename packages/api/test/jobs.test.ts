import { describe, expect, test } from "bun:test";
import { createJobApp, createJobRoutes, summarize, type JobServices } from "../src/jobs";
import { onError } from "../src/http";
import { Hono } from "hono";
import { eq } from "./helpers";

const SECRET = "s".repeat(32);

function setup(over: Partial<JobServices> = {}) {
  const calls: string[] = [];
  const jobs: JobServices = {
    dispatchQueued: async (i) => (calls.push(`dispatch:${i.limit}`), { attempted: 3, sent: 2, failed: 1, unconfirmed: 0, lost: 0, expired: 0 }),
    runOverdueJob: async () => (calls.push("overdue"), { date: "2027-03-10", students: 4, markedOverdue: 1, errors: [] }),
    runDueSoonJob: async () => (calls.push("dueSoon"), { created: 5, note: "free text is dropped" }),
    ...over,
  };
  const app = new Hono();
  app.onError(onError);
  app.route("/jobs", createJobRoutes({ jobs, secret: SECRET }));
  const post = async (path: string, init: { auth?: string | null; body?: unknown } = {}) => {
    const headers: Record<string, string> = {};
    const a = init.auth === undefined ? `Bearer ${SECRET}` : init.auth;
    if (a !== null) headers.authorization = a;
    if (init.body !== undefined) headers["content-type"] = "application/json";
    const res = await app.request(`/jobs${path}`, { method: "POST", headers, body: init.body === undefined ? undefined : JSON.stringify(init.body) });
    return { status: res.status, json: (await res.json()) as any };
  };
  return { calls, post };
}

describe("job routes: authentication", () => {
  test("a missing, wrong, partial or oddly formed secret is 401 and runs nothing", async () => {
    const { calls, post } = setup();
    for (const auth of [null, "", `Bearer ${SECRET}x`, `Bearer ${SECRET.slice(1)}`, "Bearer ", `Basic ${SECRET}`, SECRET, `bearer ${SECRET}`]) {
      for (const path of ["/dispatch", "/daily"]) {
        const r = await post(path, { auth });
        eq([r.status, r.json.error.code], [401, "unauthenticated"], `${path} with ${JSON.stringify(auth)}`);
      }
    }
    eq(calls, [], "no job ran");
  });

  test("a secret shorter than 32 characters is refused at start-up", () => {
    const jobs = setup().calls && ({} as JobServices);
    expect(() => createJobRoutes({ jobs, secret: "short" })).toThrow(/at least 32/);
    expect(() => createJobRoutes({ jobs, secret: "" })).toThrow();
    expect(() => createJobRoutes({ jobs, secret: undefined as unknown as string })).toThrow();
    createJobRoutes({ jobs, secret: SECRET });
  });
});

describe("job routes: dispatch", () => {
  test("runs with the default limit of 100, or the given one, and reports counts only", async () => {
    const { calls, post } = setup();
    const a = await post("/dispatch");
    eq([a.status, a.json], [200, { ok: true, dispatch: { attempted: 3, sent: 2, failed: 1, unconfirmed: 0, lost: 0, expired: 0 } }], "default");
    await post("/dispatch", { body: { limit: 7 } });
    await post("/dispatch", { body: { limit: 500 } });
    eq(calls, ["dispatch:100", "dispatch:7", "dispatch:500"], "limits");
  });

  test("a limit that is not a whole number from 1 to 500, or an unknown field, is 400 and runs nothing", async () => {
    const { calls, post } = setup();
    for (const body of [{ limit: 0 }, { limit: 501 }, { limit: 1.5 }, { limit: "10" }, { limit: null }, { limit: 10, other: 1 }]) {
      const r = await post("/dispatch", { body });
      eq([r.status, r.json.error.code], [400, "invalid_request"], JSON.stringify(body));
    }
    eq(calls, [], "nothing ran");
  });

  test("a failure inside the dispatcher is a 500 with no detail", async () => {
    const { post } = setup({ dispatchQueued: async () => Promise.reject(new Error("db password is hunter2")) });
    const r = await post("/dispatch");
    eq([r.status, r.json.error.code], [500, "internal_error"]);
    eq(JSON.stringify(r.json).includes("hunter2"), false, "no leak");
  });
});

describe("job routes: daily", () => {
  test("runs the overdue job then the due-soon reminders; arrays become counts and free text is dropped", async () => {
    const { calls, post } = setup();
    const r = await post("/daily");
    eq(r.status, 200);
    eq(r.json, { ok: true, overdue: { ok: true, date: "2027-03-10", students: 4, markedOverdue: 1, errors: 0 }, dueSoon: { ok: true, created: 5 } }, "body");
    eq(calls, ["overdue", "dueSoon"], "order");
    eq(JSON.stringify(r.json).includes("secret-id"), false, "no student id in the answer");
  });

  test("one failing job does not stop the other; the answer is 500 and names no detail", async () => {
    const { calls, post } = setup({ runOverdueJob: async () => Promise.reject(new Error("student Nimal Perera failed")) });
    const r = await post("/daily");
    eq(r.status, 500);
    eq(r.json, { ok: false, overdue: { ok: false }, dueSoon: { ok: true, created: 5 } }, "body");
    eq(calls, ["dueSoon"], "the second job still ran");
    eq(JSON.stringify(r.json).includes("Nimal"), false, "no leak");
  });

  test("a job that returns but lists errors has not finished: the answer is 500 with counts only, and the other job still runs", async () => {
    const failing = { date: "2027-03-10", students: 4, markedOverdue: 1, errors: [{ studentId: "secret-id", message: "boom with a name" }] };
    const { calls, post } = setup({ runOverdueJob: async () => (calls.push("overdue"), failing) });
    const r = await post("/daily");
    eq(r.status, 500);
    eq(r.json, { ok: false, overdue: { ok: false, date: "2027-03-10", students: 4, markedOverdue: 1, errors: 1 }, dueSoon: { ok: true, created: 5 } }, "body");
    eq(calls, ["overdue", "dueSoon"], "both ran");
    eq(/secret-id|boom/.test(JSON.stringify(r.json)), false, "no student id or reason");
    const second = setup({ runDueSoonJob: async () => ({ reminders: 2, errors: [{ studentId: "x", message: "y" }] }) });
    const r2 = await second.post("/daily");
    eq([r2.status, (r2.json as { dueSoon: { ok: boolean } }).dueSoon.ok], [500, false], "due-soon errors count too");
    const empty = setup({ runDueSoonJob: async () => ({ reminders: 2, errors: [] }) });
    eq((await empty.post("/daily")).status, 200, "an empty errors list is success");
  });

  test("both failing is 500 with both marked", async () => {
    const boom = async () => Promise.reject(new Error("x"));
    const { post } = setup({ runOverdueJob: boom, runDueSoonJob: boom });
    eq((await post("/daily")).json, { ok: false, overdue: { ok: false }, dueSoon: { ok: false } });
  });
});

describe("summarize", () => {
  test("keeps numbers, booleans and ISO dates; turns arrays into lengths; drops everything else", () => {
    eq(summarize({ a: 1, b: true, c: "2027-01-02", d: "free text", e: [1, 2], f: { nested: 1 }, g: null }), { a: 1, b: true, c: "2027-01-02", e: 2 });
    eq(summarize(null), {});
    eq(summarize("x"), {});
  });
});

describe("createJobApp", () => {
  test("serves the routes under its base path, maps errors, and answers 404 elsewhere", async () => {
    const { calls } = setup();
    const jobs: JobServices = { dispatchQueued: async (i) => (calls.push(`d${i.limit}`), {}), runOverdueJob: async () => ({}), runDueSoonJob: async () => ({}) };
    const app = createJobApp({ jobs, secret: SECRET, basePath: "/api/internal/jobs" });
    const call = (path: string, auth?: string) => app.request(path, { method: "POST", headers: auth ? { authorization: auth } : {} });
    const unauth = await call("/api/internal/jobs/dispatch");
    eq([unauth.status, ((await unauth.json()) as any).error.code], [401, "unauthenticated"]);
    eq((await call("/api/internal/jobs/dispatch", `Bearer ${SECRET}`)).status, 200);
    eq(calls, ["d100"]);
    eq((await call("/dispatch", `Bearer ${SECRET}`)).status, 404, "not served outside the base path");
    eq((await call("/api/internal/jobs/nope", `Bearer ${SECRET}`)).status, 404);
  });
});
