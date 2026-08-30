"use client";

import { useState } from "react";
import { useAuditLog, useMe } from "@/components/hooks";
import { Button, Card, Empty, Label, Loading, Notice, PageHeading, Pill, Select } from "@/components/ui";
import { cn } from "@/lib/cn";
import { ApiError, type AuditEvent } from "@/lib/api";

const th =
  "border-b border-line-9 px-[11px] py-[9px] text-left text-[11.5px] font-medium text-muted whitespace-nowrap";
const td = "p-[11px] text-sm align-top";

/** `30 Aug 2026, 11:04` — the same clock the reader is looking at. */
function when(iso: string): string {
  return new Date(iso).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Who did what, in the order it happened.
 *
 * The owner's page alone: it names every account and everything they touched,
 * which is more than a super-admin needs in order to do their own job.
 */
export function AuditScreen() {
  const { data: me, isPending: mePending } = useMe();
  /* A stack of page boundaries, so Back is exact rather than re-counted. */
  const [pages, setPages] = useState<number[]>([]);
  const [actor, setActor] = useState("");

  const before = pages.at(-1);
  const log = useAuditLog({ before, actor: actor || undefined });

  if (mePending) return <Loading label="Loading…" />;

  if (me?.actor?.role !== "owner") {
    return (
      <section aria-label="Audit log">
        <PageHeading title="Audit log" />
        <Notice tone="error">Only the owner can read the audit log.</Notice>
      </section>
    );
  }

  if (log.isPending) return <Loading label="Loading the audit log…" />;

  if (log.error) {
    return (
      <section aria-label="Audit log">
        <PageHeading title="Audit log" />
        <Notice tone="error">
          {log.error instanceof ApiError ? log.error.message : "Could not load the audit log."}
        </Notice>
      </section>
    );
  }

  const events = log.data?.events ?? [];
  const actors = log.data?.actors ?? [];

  return (
    <section aria-label="Audit log">
      <PageHeading
        title="Audit log"
        subtitle="Every change to the sheet, the units, the files and the accounts — who made it, and when."
        actions={
          actors.length > 1 ? (
            <div className="w-[240px] text-left">
              <Label htmlFor="audit-actor">Account</Label>
              <Select
                id="audit-actor"
                value={actor}
                onChange={(e) => {
                  setActor(e.target.value);
                  /* A new filter is a new list; the old boundaries meant nothing in it. */
                  setPages([]);
                }}
              >
                <option value="">Everyone</option>
                {actors.map((email) => (
                  <option key={email} value={email}>
                    {email}
                  </option>
                ))}
              </Select>
            </div>
          ) : null
        }
      />

      <Card className="overflow-hidden p-0">
        {events.length === 0 ? (
          <Empty>
            {actor
              ? "Nothing recorded for that account yet."
              : "Nothing recorded yet. Changes made from here on will appear."}
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={cn(th, "w-[170px] pl-5")}>When</th>
                  <th scope="col" className={cn(th, "w-[230px]")}>Who</th>
                  <th scope="col" className={cn(th, "w-[170px]")}>Did what</th>
                  <th scope="col" className={cn(th, "min-w-[200px]")}>To what</th>
                  <th scope="col" className={cn(th, "pr-5")}>Detail</th>
                </tr>
              </thead>
              <tbody>
                {events.map((event: AuditEvent, i) => (
                  <tr
                    key={event.id}
                    className={cn(i < events.length - 1 && "border-b border-line-5")}
                  >
                    <td className={cn(td, "pl-5 text-[13px] whitespace-nowrap text-muted")}>
                      {when(event.createdAt)}
                    </td>
                    <td className={cn(td, "text-[13px]")}>
                      {event.actorEmail}
                      {event.stillAnAccount ? null : (
                        <Pill className="ml-1.5 bg-chip text-slate">gone</Pill>
                      )}
                    </td>
                    <td className={cn(td, "font-medium")}>{event.label}</td>
                    <td className={td}>{event.subject}</td>
                    <td className={cn(td, "pr-5 text-[13px] text-muted")}>{event.detail || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {pages.length > 0 || log.data?.more ? (
        <div className="mt-5 flex items-center gap-2.5">
          <Button disabled={pages.length === 0} onClick={() => setPages((p) => p.slice(0, -1))}>
            Newer
          </Button>
          <Button
            disabled={!log.data?.more}
            onClick={() => {
              const last = events.at(-1);
              if (last) setPages((p) => [...p, last.id]);
            }}
          >
            Older
          </Button>
        </div>
      ) : null}
    </section>
  );
}
