"use client";

import { useCallback, useEffect, useState } from "react";
import { Button, Card, Empty, Loading, Notice, PageHeading, Pill, Select } from "@/components/ui";
import { cn } from "@/lib/cn";

type ManagedAccount = {
  id: number;
  email: string;
  status: "awaiting" | "approved" | "rejected";
  role: "owner" | "super_admin" | "viewer" | null;
  createdAt: string;
};

const ROLE_LABEL: Record<string, string> = {
  super_admin: "Can edit",
  viewer: "View only",
};

const th =
  "border-b border-line-9 px-[11px] py-[9px] text-left text-[11.5px] font-medium text-muted whitespace-nowrap";
const td = "p-[11px] text-sm";

export function ApprovalsScreen() {
  const [rows, setRows] = useState<ManagedAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);
  /** Which role the owner has picked for each account still awaiting a decision. */
  const [choice, setChoice] = useState<Record<number, "super_admin" | "viewer">>({});

  const load = useCallback(async () => {
    setError(null);
    try {
      const response = await fetch("/api/accounts");
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Could not load the accounts.");
        setRows([]);
        return;
      }
      const body = (await response.json()) as { accounts: ManagedAccount[] };
      setRows(body.accounts);
    } catch {
      setError("Could not reach the server.");
      setRows([]);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  async function act(id: number, body: Record<string, unknown>, success: string) {
    setBusy(id);
    setError(null);
    setNote(null);
    try {
      const response = await fetch(`/api/accounts/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!response.ok) {
        const failed = (await response.json().catch(() => ({}))) as { error?: string };
        setError(failed.error ?? "That did not work.");
        return;
      }
      setNote(success);
      await load();
    } catch {
      setError("Could not reach the server.");
    } finally {
      setBusy(null);
    }
  }

  return (
    <section aria-label="Accounts">
      <PageHeading
        title="Accounts"
        subtitle="Who can open the sheet, and what they can do with it. There is no email — check here when someone tells you they have asked."
      />

      {error ? <div className="mb-4">{<Notice tone="error">{error}</Notice>}</div> : null}
      {note ? <div className="mb-4">{<Notice tone="success">{note}</Notice>}</div> : null}

      <Card className="overflow-hidden p-0">
        {rows === null ? (
          <Loading label="Loading accounts…" />
        ) : rows.length === 0 ? (
          <Empty>
            Nobody has asked for access yet. Send them the sign-in page and they can ask from there.
          </Empty>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={cn(th, "pl-5")}>
                    Email
                  </th>
                  <th scope="col" className={th}>
                    Status
                  </th>
                  <th scope="col" className={cn(th, "pr-5 text-right")}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={cn(i < rows.length - 1 && "border-b border-line-5")}
                  >
                    <td className={cn(td, "pl-5 font-medium")}>{row.email}</td>
                    <td className={td}>
                      {row.status === "awaiting" ? (
                        <Pill className="bg-amber-tint text-amber-ink">Waiting</Pill>
                      ) : row.status === "rejected" ? (
                        <Pill className="bg-chip text-slate">Not approved</Pill>
                      ) : (
                        <Pill className="bg-brand-tint text-brand-deep">
                          {ROLE_LABEL[row.role ?? ""] ?? "Approved"}
                        </Pill>
                      )}
                    </td>
                    <td className={cn(td, "pr-5")}>
                      <div className="flex flex-wrap items-center justify-end gap-2">
                        {row.status === "awaiting" ? (
                          <>
                            <label className="sr-only" htmlFor={`role-${row.id}`}>
                              Role for {row.email}
                            </label>
                            <Select
                              id={`role-${row.id}`}
                              className="w-auto py-1.5 text-[13px]"
                              value={choice[row.id] ?? "viewer"}
                              onChange={(e) =>
                                setChoice((c) => ({
                                  ...c,
                                  [row.id]: e.target.value as "super_admin" | "viewer",
                                }))
                              }
                            >
                              <option value="viewer">View only</option>
                              <option value="super_admin">Can edit</option>
                            </Select>
                            <Button
                              variant="primary"
                              className="px-3 py-1.5 text-[13px]"
                              disabled={busy === row.id}
                              onClick={() =>
                                act(
                                  row.id,
                                  { action: "approve", role: choice[row.id] ?? "viewer" },
                                  `${row.email} can now sign in.`,
                                )
                              }
                            >
                              Approve
                            </Button>
                            <Button
                              className="px-3 py-1.5 text-[13px] text-muted"
                              disabled={busy === row.id}
                              onClick={() =>
                                act(row.id, { action: "reject" }, `${row.email} was not approved.`)
                              }
                            >
                              Reject
                            </Button>
                          </>
                        ) : row.status === "approved" ? (
                          <Button
                            className="px-3 py-1.5 text-[13px]"
                            disabled={busy === row.id}
                            onClick={() =>
                              act(
                                row.id,
                                {
                                  action: "set-role",
                                  role: row.role === "super_admin" ? "viewer" : "super_admin",
                                },
                                row.role === "super_admin"
                                  ? `${row.email} can now only view.`
                                  : `${row.email} can now edit.`,
                              )
                            }
                          >
                            {row.role === "super_admin" ? "Make view-only" : "Let them edit"}
                          </Button>
                        ) : (
                          <Button
                            className="px-3 py-1.5 text-[13px]"
                            disabled={busy === row.id}
                            onClick={() =>
                              act(
                                row.id,
                                { action: "approve", role: "viewer" },
                                `${row.email} can now sign in.`,
                              )
                            }
                          >
                            Let them in after all
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </section>
  );
}
