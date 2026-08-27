/**
 * Refusals that protect real data from a stray test run. The suite talks to a
 * real Postgres database and a real R2 bucket rather than mocks, so the cost of
 * pointing it at the wrong one is losing data that matters.
 *
 * These are pure functions so they can be tested without importing the setup
 * file's side effects.
 */

/** A database this suite is allowed to truncate. */
export function assertTestDatabase(url: string | undefined): void {
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Copy .env.example to .env.test and point it at the test database.",
    );
  }

  let name: string;
  try {
    name = new URL(url).pathname.replace(/^\//, "");
  } catch {
    throw new Error(`DATABASE_URL is not a valid URL: ${url}`);
  }

  if (!/(^|[_-])test($|[_-])/.test(name)) {
    throw new Error(
      `Refusing to run tests against database "${name}" — its name does not mark it as a test database.`,
    );
  }
}

/** A bucket this suite is allowed to write to and delete from. */
export function assertTestBucket(bucket: string | undefined): void {
  if (!bucket) {
    throw new Error("R2_BUCKET is not set. Point it at the test bucket.");
  }

  if (!/(^|[_-])test($|[_-])/.test(bucket)) {
    throw new Error(
      `Refusing to run tests against bucket "${bucket}" — its name does not mark it as a test bucket.`,
    );
  }
}
