/**
 * A fixed-window limiter held in memory. The app runs as one instance, so a
 * shared store would be ceremony; a restart clears the counters, which is
 * acceptable for a household of four and stated rather than discovered.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

export type Limit = { max: number; windowMs: number };

export const SIGN_IN_PER_EMAIL: Limit = { max: 5, windowMs: 15 * 60 * 1000 };
export const SIGN_IN_PER_ADDRESS: Limit = { max: 20, windowMs: 15 * 60 * 1000 };
export const REGISTER_PER_ADDRESS: Limit = { max: 5, windowMs: 60 * 60 * 1000 };
export const PASSWORD_CHANGE_PER_ACCOUNT: Limit = { max: 5, windowMs: 15 * 60 * 1000 };

/** Returns false when the caller has run out of attempts in the current window. */
export function consume(key: string, limit: Limit, now = Date.now()): boolean {
  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    windows.set(key, { count: 1, resetAt: now + limit.windowMs });
    return true;
  }
  if (existing.count >= limit.max) return false;
  existing.count += 1;
  return true;
}

/** Called after a success, so a legitimate sign-in clears the failure count. */
export function reset(key: string): void {
  windows.delete(key);
}

/** Test seam only. */
export function clearAllWindows(): void {
  windows.clear();
}
