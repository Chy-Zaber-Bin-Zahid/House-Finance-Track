/**
 * Rules the browser and the server both have to know.
 *
 * They live here, away from the code that enforces them, because that code
 * imports argon2 — a native module. A client component reaching into it for one
 * number would pull the whole thing into the browser bundle.
 */

/** Short passwords are the one thing argon2 cannot protect against. */
export const MIN_PASSWORD_LENGTH = 12;
