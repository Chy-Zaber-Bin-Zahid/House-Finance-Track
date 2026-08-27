import argon2 from "argon2";

/**
 * OWASP ranks argon2id first for password storage. Node has no native Argon2 in
 * this runtime, so this comes from the `argon2` package rather than node:crypto.
 * Tune the cost down if sign-in feels slow on the machine this runs on; do not
 * swap the algorithm.
 */
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536, // 64 MB
  timeCost: 3,
  parallelism: 4,
} as const;

/** Short passwords are the one thing argon2 cannot protect against. */
export const MIN_PASSWORD_LENGTH = 12;

export class WeakPassword extends Error {
  constructor() {
    super(`Choose a password of at least ${MIN_PASSWORD_LENGTH} characters.`);
    this.name = "WeakPassword";
  }
}

export async function hashPassword(password: string): Promise<string> {
  if (password.length < MIN_PASSWORD_LENGTH) throw new WeakPassword();
  return argon2.hash(password, OPTIONS);
}

export async function verifyPassword(hash: string, password: string): Promise<boolean> {
  try {
    return await argon2.verify(hash, password);
  } catch {
    return false;
  }
}
