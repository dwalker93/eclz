import { createHmac, randomBytes } from "node:crypto";

const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(text: string): Buffer {
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of text.toUpperCase().replace(/=+$/, "")) {
    const i = ALPHABET.indexOf(ch);
    if (i < 0) throw new Error("Invalid base32");
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

export const newTotpSecret = () => base32Encode(randomBytes(20));

/** RFC 4226 HOTP, 6 digits. */
export function hotp(secret: string, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const h = createHmac("sha1", base32Decode(secret)).update(msg).digest();
  const o = h[h.length - 1]! & 15;
  const code = ((h[o]! & 127) << 24) | (h[o + 1]! << 16) | (h[o + 2]! << 8) | h[o + 3]!;
  return String(code % 1_000_000).padStart(6, "0");
}

export const totpStep = (at: Date) => Math.floor(at.getTime() / 30_000);
export const totp = (secret: string, at: Date) => hotp(secret, totpStep(at));

/** RFC 6238, 30-second steps. Accepts the previous and next step for clock drift. Returns the matching step or null. */
export function verifyTotp(secret: string, code: string, at: Date, window = 1): number | null {
  const c = code.replace(/\s/g, "");
  if (!/^\d{6}$/.test(c)) return null;
  const step = totpStep(at);
  for (let d = -window; d <= window; d++) if (hotp(secret, step + d) === c) return step + d;
  return null;
}

export function otpauthUri(input: { secret: string; account: string; issuer: string }): string {
  const label = encodeURIComponent(`${input.issuer}:${input.account}`);
  return `otpauth://totp/${label}?secret=${input.secret}&issuer=${encodeURIComponent(input.issuer)}&algorithm=SHA1&digits=6&period=30`;
}
