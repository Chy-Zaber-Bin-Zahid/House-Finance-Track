/**
 * A fixed-window limiter held in memory. The app runs as one instance, so a
 * shared store would be ceremony; a restart clears the counters, which is
 * acceptable for a household of four and stated rather than discovered.
 */
type Window = { count: number; resetAt: number };

const windows = new Map<string, Window>();

/**
 * A backstop, not a policy. Keys embed caller-supplied values, so without a
 * bound the limiter's own state is the memory leak.
 */
const MAX_WINDOWS = 10_000;

function prune(now: number): void {
  for (const [key, window] of windows) {
    if (window.resetAt <= now) windows.delete(key);
  }
}

export type Limit = { max: number; windowMs: number };

export const SIGN_IN_PER_EMAIL: Limit = { max: 5, windowMs: 15 * 60 * 1000 };
export const SIGN_IN_PER_ADDRESS: Limit = { max: 20, windowMs: 15 * 60 * 1000 };
export const REGISTER_PER_ADDRESS: Limit = { max: 5, windowMs: 60 * 60 * 1000 };
export const PASSWORD_CHANGE_PER_ACCOUNT: Limit = { max: 5, windowMs: 15 * 60 * 1000 };

/** Returns false when the caller has run out of attempts in the current window. */
export function consume(key: string, limit: Limit, now = Date.now()): boolean {
  const existing = windows.get(key);
  if (!existing || existing.resetAt <= now) {
    if (windows.size >= MAX_WINDOWS) prune(now);
    /* Still full of live windows: refuse rather than grow without bound. */
    if (windows.size >= MAX_WINDOWS) return false;
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

/** How many windows are held, so a test can prove the bound. */
export function windowCount(): number {
  return windows.size;
}

/** Test seam only. */
export function clearAllWindows(): void {
  windows.clear();
}
