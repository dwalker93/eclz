import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from "node:crypto";

export const sha256 = (text: string) => createHash("sha256").update(text).digest("hex");

export function newToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** AES-256-GCM with a key derived from the server secret. Output: base64(iv | tag | ciphertext). */
export function encrypt(secretKey: string, plain: string): string {
  const key = createHash("sha256").update(secretKey).digest();
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const ct = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return Buffer.concat([iv, c.getAuthTag(), ct]).toString("base64");
}

export function decrypt(secretKey: string, blob: string): string {
  const key = createHash("sha256").update(secretKey).digest();
  const raw = Buffer.from(blob, "base64");
  const d = createDecipheriv("aes-256-gcm", key, raw.subarray(0, 12));
  d.setAuthTag(raw.subarray(12, 28));
  return Buffer.concat([d.update(raw.subarray(28)), d.final()]).toString("utf8");
}
