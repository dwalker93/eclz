import { ServiceError } from "@workspace/domain";

export const MIN_PASSWORD_LENGTH = 10;

export function checkPassword(password: string): void {
  if (password.length < MIN_PASSWORD_LENGTH) throw new ServiceError("weak_password", `Use at least ${MIN_PASSWORD_LENGTH} characters.`);
  if (password.length > 200) throw new ServiceError("weak_password", "The password is too long.");
  if (/^(.)\1+$/.test(password) || /^(0123456789|1234567890|password)/i.test(password)) throw new ServiceError("weak_password", "Choose a less guessable password.");
}

export const hashPassword = (password: string) => Bun.password.hash(password, { algorithm: "argon2id" });

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(password, hash);
  } catch {
    return false;
  }
}

let dummy: Promise<string> | undefined;
/** Verifies against a throwaway hash so an unknown user costs the same time as a wrong password. */
export async function burnTime(password: string): Promise<void> {
  dummy ??= hashPassword("not-a-real-password-0");
  await verifyPassword(password, await dummy);
}
