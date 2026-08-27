/**
 * A refusal the caller is allowed to see. Everything else is a bug and should
 * surface as a 500 rather than leaking its reason.
 */
export class AccessDenied extends Error {
  constructor(
    readonly reason:
      | "signed-out"
      | "awaiting-approval"
      | "rejected"
      | "read-only"
      | "owner-only"
      | "year-locked",
    message: string,
  ) {
    super(message);
    this.name = "AccessDenied";
  }
}

export class NotFound extends Error {
  constructor(message = "Not found") {
    super(message);
    this.name = "NotFound";
  }
}

/** A write the database refused because something still references the record. */
export class StillReferenced extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StillReferenced";
  }
}
