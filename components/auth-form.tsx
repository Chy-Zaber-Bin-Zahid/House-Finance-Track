"use client";

import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { Button, Card, Field, Label } from "@/components/ui";
import { HouseIcon } from "@/components/icons";

/**
 * The shape both sign-in and registration share. New here: the app can now
 * fail, so a submitted form has three outcomes rather than one, and the screen
 * has to say which.
 */
export function AuthForm({
  title,
  intro,
  submitLabel,
  endpoint,
  onDone,
  footer,
}: {
  title: string;
  intro: string;
  submitLabel: string;
  endpoint: string;
  /** Where to go, or what to show, once the server accepts the form. */
  onDone: { redirect: string } | { message: string };
  footer: React.ReactNode;
}) {
  const router = useRouter();
  const emailId = useId();
  const passwordId = useId();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setPending(true);
    setError(null);
    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        setError(body.error ?? "Something went wrong. Try again.");
        return;
      }
      if ("redirect" in onDone) {
        router.push(onDone.redirect);
        router.refresh();
      } else {
        setDone(true);
      }
    } catch {
      setError("Could not reach the server. Check your connection and try again.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-[420px] flex-col justify-center">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="grid size-7 place-items-center rounded-nav bg-ink text-white">
          <HouseIcon className="size-[15px]" />
        </span>
        <span className="text-base font-semibold tracking-[-0.01em]">My house</span>
      </div>

      <Card className="px-[22px] pt-[22px] pb-6">
        <h1 className="mb-1 text-[22px] font-semibold tracking-[-0.02em]">{title}</h1>
        <p className="mb-5 text-[13px] text-muted">{intro}</p>

        {done && "message" in onDone ? (
          <p
            role="status"
            className="rounded-field border border-brand/30 bg-brand-tint px-[13px] py-2.5 text-[13px] text-brand-deep"
          >
            {onDone.message}
          </p>
        ) : (
          <form onSubmit={submit} className="flex flex-col gap-[13px]">
            <div>
              <Label htmlFor={emailId}>Email</Label>
              <Field
                id={emailId}
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={passwordId}>Password</Label>
              <Field
                id={passwordId}
                type="password"
                autoComplete={endpoint.includes("sign-in") ? "current-password" : "new-password"}
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>

            {error ? (
              <p
                role="alert"
                className="rounded-field border border-amber/45 bg-amber-tint px-[13px] py-2.5 text-[13px] text-amber-ink"
              >
                {error}
              </p>
            ) : null}

            <Button type="submit" variant="primary" disabled={pending} className="mt-1 justify-center">
              {pending ? "One moment…" : submitLabel}
            </Button>
          </form>
        )}
      </Card>

      <p className="mt-4 text-center text-[13px] text-muted">{footer}</p>
    </div>
  );
}
