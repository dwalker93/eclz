import { describe, expect, test } from "bun:test";
import worker, { JOB_PATH, SCHEDULES, jobFor, jobUrl, runJob, type Env } from "../src";

const env: Env = { API_URL: "https://admin.example.com", JOB_SECRET: "k".repeat(40) };
const noWait = async () => {};
const fail = async (p: Promise<unknown>) => {
  try {
    await p;
  } catch (e) {
    return (e as Error).message;
  }
  return null;
};

type Call = { url: string; init: RequestInit };
function fakeFetch(...answers: (number | Error)[]) {
  const calls: Call[] = [];
  const f = (async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    const a = answers[Math.min(calls.length - 1, answers.length - 1)]!;
    if (a instanceof Error) throw a;
    return new Response("{}", { status: a });
  }) as unknown as typeof fetch;
  return { f, calls };
}

describe("schedules", () => {
  test("every minute dispatches, 00:30 UTC runs the daily jobs, anything else is an error", () => {
    expect(jobFor("* * * * *")).toBe("dispatch");
    expect(jobFor("30 0 * * *")).toBe("daily");
    expect(() => jobFor("5 4 * * *")).toThrow(/no job is set/);
    expect(Object.keys(SCHEDULES).sort()).toEqual(["* * * * *", "30 0 * * *"]);
  });

  test("wrangler.jsonc lists exactly the cron strings the Worker knows", async () => {
    const text = await Bun.file(new URL("../wrangler.jsonc", import.meta.url)).text();
    const crons = JSON.parse(/"crons":\s*(\[[^\]]*\])/.exec(text)![1]!) as string[];
    expect([...crons].sort()).toEqual(Object.keys(SCHEDULES).sort());
  });
});

describe("jobUrl", () => {
  test("joins the origin and the job path, whatever path or trailing slash the base has", () => {
    expect(jobUrl(env, "dispatch")).toBe(`https://admin.example.com${JOB_PATH}/dispatch`);
    expect(jobUrl({ ...env, API_URL: "https://admin.example.com/some/path/" }, "daily")).toBe(`https://admin.example.com${JOB_PATH}/daily`);
    expect(jobUrl({ ...env, API_URL: "http://localhost:3001" }, "daily")).toBe(`http://localhost:3001${JOB_PATH}/daily`);
  });

  test("a missing or short secret, a bad address or plain http to a real host is refused without printing the secret", () => {
    expect(() => jobUrl({ ...env, JOB_SECRET: "short" }, "daily")).toThrow(/JOB_SECRET/);
    expect(() => jobUrl({ ...env, JOB_SECRET: undefined as unknown as string }, "daily")).toThrow(/JOB_SECRET/);
    expect(() => jobUrl({ ...env, API_URL: "not a url" }, "daily")).toThrow(/API_URL/);
    expect(() => jobUrl({ ...env, API_URL: "" }, "daily")).toThrow(/API_URL/);
    expect(() => jobUrl({ ...env, API_URL: "http://admin.example.com" }, "daily")).toThrow(/https/);
    try {
      jobUrl({ ...env, API_URL: "nope" }, "daily");
    } catch (e) {
      expect((e as Error).message).not.toContain(env.JOB_SECRET);
    }
  });
});

describe("runJob", () => {
  test("posts once with the bearer secret and does not follow redirects", async () => {
    const { f, calls } = fakeFetch(200);
    await runJob("dispatch", env, { fetch: f, sleep: noWait });
    expect(calls.length).toBe(1);
    expect(calls[0]!.url).toBe(`https://admin.example.com${JOB_PATH}/dispatch`);
    expect(calls[0]!.init.method).toBe("POST");
    expect((calls[0]!.init.headers as Record<string, string>).authorization).toBe(`Bearer ${env.JOB_SECRET}`);
    expect(calls[0]!.init.redirect).toBe("manual");
    expect(calls[0]!.init.signal).toBeInstanceOf(AbortSignal);
  });

  test("a redirect answer is final and is not followed: one call, the run fails, the secret goes nowhere else", async () => {
    const { f, calls } = fakeFetch(302);
    await expect(runJob("dispatch", env, { fetch: f, sleep: noWait })).rejects.toThrow("dispatch job answered 302");
    expect(calls.length).toBe(1);
  });

  test("a 5xx answer or a network error is retried up to three times, then fails; a later success ends it", async () => {
    const a = fakeFetch(503, new Error("boom"), 200);
    await runJob("daily", env, { fetch: a.f, sleep: noWait });
    expect(a.calls.length).toBe(3);
    const b = fakeFetch(500);
    expect(await fail(runJob("daily", env, { fetch: b.f, sleep: noWait }))).toMatch(/failed after 3 attempts \(answered 500\)/);
    expect(b.calls.length).toBe(3);
    const c = fakeFetch(new TypeError("fetch failed"));
    expect(await fail(runJob("daily", env, { fetch: c.f, sleep: noWait }))).toMatch(/failed after 3 attempts \(TypeError\)/);
  });

  test("waits 1 s then 3 s between attempts", async () => {
    const waits: number[] = [];
    const { f } = fakeFetch(502);
    await fail(runJob("daily", env, { fetch: f, sleep: async (ms) => void waits.push(ms) }));
    expect(waits).toEqual([1000, 3000]);
  });

  test("a 401, 400 or 404 is final: it is not retried", async () => {
    for (const status of [401, 400, 404]) {
      const { f, calls } = fakeFetch(status);
      expect(await fail(runJob("dispatch", env, { fetch: f, sleep: noWait }))).toBe(`dispatch job answered ${status}`);
      expect(calls.length).toBe(1);
    }
  });

  test("a call that hangs is cut off by the timeout and retried", async () => {
    let calls = 0;
    const hang = (async (_u: string, init: RequestInit) => {
      calls++;
      return new Promise<Response>((_r, reject) => init.signal!.addEventListener("abort", () => reject(init.signal!.reason)));
    }) as unknown as typeof fetch;
    expect(await fail(runJob("dispatch", env, { fetch: hang, sleep: noWait, timeoutMs: 20 }))).toMatch(/failed after 3 attempts/);
    expect(calls).toBe(3);
  });

  test("the error never contains the secret", async () => {
    const { f } = fakeFetch(new Error(`leak ${env.JOB_SECRET}`));
    const msg = await fail(runJob("dispatch", env, { fetch: f, sleep: noWait }));
    expect(msg).not.toContain(env.JOB_SECRET);
  });
});

describe("scheduled handler", () => {
  test("hands the job for the cron that fired to waitUntil", async () => {
    const { f, calls } = fakeFetch(200);
    const realFetch = globalThis.fetch;
    globalThis.fetch = f;
    try {
      const pending: Promise<unknown>[] = [];
      await worker.scheduled({ cron: "30 0 * * *", scheduledTime: 0 }, env, { waitUntil: (p) => void pending.push(p) });
      await Promise.all(pending);
      expect(calls.map((c) => c.url)).toEqual([`https://admin.example.com${JOB_PATH}/daily`]);
    } finally {
      globalThis.fetch = realFetch;
    }
  });

  test("an unknown cron string throws instead of running something", async () => {
    await expect(worker.scheduled({ cron: "1 2 3 4 5", scheduledTime: 0 }, env, { waitUntil: () => {} })).rejects.toThrow(/no job is set/);
  });
});
