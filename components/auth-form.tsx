"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import { EyeIcon, EyeOffIcon } from "@/components/icons";
import { MIN_PASSWORD_LENGTH } from "@/lib/limits";
import { Button, Field, Label } from "@/components/ui";
import { LogoLockup } from "@/components/logo";
import signInImage from "@/public/sign-in.jpg";

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
  const [showPassword, setShowPassword] = useState(false);

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
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/*
        Decorative, and heavy, so it is never the reason a narrow screen has to
        scroll before it can reach the form: below `lg` it is not rendered.
      */}
      <div className="relative hidden lg:block">
        <Image
          src={signInImage}
          alt=""
          aria-hidden
          priority
          placeholder="blur"
          sizes="(min-width: 1024px) 52vw, 0px"
          className="absolute inset-0 size-full object-cover"
        />
        {/*
          Deepened at the foot so the caption holds its contrast wherever the
          crop lands — the path at the bottom of this photograph is bright, and
          white text alone does not survive it.
        */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(to top, rgba(8,20,13,0.9) 0%, rgba(8,20,13,0.55) 22%, rgba(8,20,13,0.1) 48%, transparent 70%)",
          }}
        />
        <div className="absolute inset-x-0 bottom-0 p-10 text-white">
          <p className="max-w-[26rem] text-[19px] leading-snug font-medium tracking-[-0.01em]">
            Every taka in and out of the house, kept in one place, year after year.
          </p>
        </div>
      </div>

      <div className="flex flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-[380px]">
          <LogoLockup className="mb-7 h-[104px] w-[101px]" />

          <h1 className="mb-1 text-[26px] font-semibold tracking-[-0.02em]">{title}</h1>
          <p className="mb-6 text-sm text-muted">{intro}</p>

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
                placeholder="you@example.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <div>
              <Label htmlFor={passwordId}>Password</Label>
              <div className="relative">
                <Field
                  id={passwordId}
                  type={showPassword ? "text" : "password"}
                  autoComplete={endpoint.includes("sign-in") ? "current-password" : "new-password"}
                  /* Registering states the rule up front rather than failing on it. */
                  placeholder={
                    endpoint.includes("sign-in")
                      ? "Your password"
                      : `At least ${MIN_PASSWORD_LENGTH} characters`
                  }
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="pr-[38px]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((shown) => !shown)}
                  /* Never submits, and never takes the tab stop between the
                   * password and the button the form is actually for. */
                  tabIndex={-1}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute inset-y-0 right-0 grid w-[38px] cursor-pointer place-items-center text-muted-2 transition-colors hover:text-ink"
                >
                  {showPassword ? <EyeOffIcon className="size-[17px]" /> : <EyeIcon className="size-[17px]" />}
                </button>
              </div>
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

          <p className="mt-6 text-[13px] text-muted">{footer}</p>
        </div>
      </div>
    </div>
  );
}
