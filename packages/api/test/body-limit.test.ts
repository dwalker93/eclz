import { describe, expect, test } from "bun:test";
import { Hono } from "hono";
import { z } from "zod";
import { JSON_BODY_LIMIT, LARGE_JSON_BODY_LIMIT, jsonBody, onError } from "../src/http";
import { eq } from "./helpers";

const schema = z.object({ pad: z.string().optional() }).strict();

function app(limit?: number) {
  const a = new Hono();
  a.onError(onError);
  a.post("/x", async (c) => c.json(await (limit === undefined ? jsonBody(c, schema) : jsonBody(c, schema, limit))));
  return a;
}

/** A body of exactly `bytes` bytes of valid JSON. */
const jsonOf = (bytes: number) => {
  const wrapper = `{"pad":""}`.length;
  return `{"pad":"${"a".repeat(bytes - wrapper)}"}`;
};

/** A streamed body (no Content-Length) that records whether the reader cancelled it. */
function stream(chunk: string, times: number) {
  const state = { pulled: 0, cancelled: false };
  const enc = new TextEncoder().encode(chunk);
  const body = new ReadableStream<Uint8Array>({
    pull(ctl) {
      if (state.pulled >= times) return ctl.close();
      state.pulled += 1;
      ctl.enqueue(enc);
    },
    cancel() {
      state.cancelled = true;
    },
  }, { highWaterMark: 0 });
  return { body, state };
}

const post = async (a: Hono, init: RequestInit) => {
  const res = await a.request("/x", { method: "POST", ...init });
  return { status: res.status, json: (await res.json()) as { error?: { code: string } } };
};

describe("jsonBody size limit", () => {
  test("the defaults are 64 KiB and 512 KiB", () => {
    eq([JSON_BODY_LIMIT, LARGE_JSON_BODY_LIMIT], [65536, 524288]);
  });

  test("a body at the limit is read; one byte more is 413 payload_too_large", async () => {
    const ok = await post(app(), { body: jsonOf(JSON_BODY_LIMIT) });
    eq(ok.status, 200);
    const over = await post(app(), { body: jsonOf(JSON_BODY_LIMIT + 1) });
    eq([over.status, over.json.error?.code], [413, "payload_too_large"]);
  });

  test("the size is counted in bytes, not characters", async () => {
    // "é" is two bytes: 40 000 of them are 80 000 bytes but only 40 000 characters.
    const body = JSON.stringify({ pad: "é".repeat(40_000) });
    eq(body.length < JSON_BODY_LIMIT, true);
    const r = await post(app(), { body });
    eq([r.status, r.json.error?.code], [413, "payload_too_large"]);
  });

  test("a declared Content-Length over the limit is refused without reading the stream", async () => {
    const { body, state } = stream("a".repeat(1024), 10);
    const r = await post(app(1000), { body, headers: { "content-length": "999999" }, duplex: "half" } as RequestInit);
    eq([r.status, r.json.error?.code], [413, "payload_too_large"]);
    eq(state.pulled, 0, "nothing was pulled from the stream");
  });

  test("a streamed body with no Content-Length is cut off at the limit and the stream is cancelled", async () => {
    const { body, state } = stream("a".repeat(1024), 1000);
    const r = await post(app(10_000), { body, duplex: "half" } as RequestInit);
    eq([r.status, r.json.error?.code], [413, "payload_too_large"]);
    eq(state.cancelled, true, "stream cancelled");
    eq(state.pulled < 20, true, "stopped reading soon after the limit");
  });

  test("a false small Content-Length does not let a bigger body through", async () => {
    const r = await post(app(1000), { body: jsonOf(5000), headers: { "content-length": "10" } });
    eq(r.status === 413 || r.status === 400, true, "refused either way");
    eq(r.status === 200, false);
  });

  test("an empty body is still {} and bad JSON is still 400", async () => {
    eq((await post(app(), { body: "" })).status, 200);
    const bad = await post(app(), { body: "{nope" });
    eq([bad.status, bad.json.error?.code], [400, "invalid_json"]);
  });

  test("a route can ask for a larger limit", async () => {
    const big = jsonOf(JSON_BODY_LIMIT * 2);
    eq((await post(app(), { body: big })).status, 413);
    eq((await post(app(LARGE_JSON_BODY_LIMIT), { body: big })).status, 200);
  });
});
