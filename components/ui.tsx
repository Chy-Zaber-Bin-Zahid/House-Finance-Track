import Link from "next/link";
import type { ComponentProps } from "react";
import type {
  ButtonHTMLAttributes,
  HTMLAttributes,
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { cn } from "@/lib/cn";

const focusRing =
  "focus-visible:outline-2 focus-visible:outline-brand focus-visible:outline-offset-2";

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "rounded-card border border-line-5 bg-surface shadow-card",
        className,
      )}
      {...props}
    />
  );
}

export type ButtonVariant = "primary" | "secondary";

function buttonClasses(variant: ButtonVariant, className?: string) {
  return cn(
    "inline-flex cursor-pointer items-center gap-[7px] rounded-field border px-[15px] py-[9px] text-sm font-medium whitespace-nowrap transition-colors",
    focusRing,
    "disabled:cursor-not-allowed disabled:opacity-40",
    variant === "primary"
      ? "border-transparent bg-ink text-white hover:bg-ink-hover"
      : "border-line-13 bg-white text-ink hover:border-line-20 hover:bg-surface-hover",
    className,
  );
}

export function Button({
  variant = "secondary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant }) {
  return <button className={buttonClasses(variant, className)} {...props} />;
}

/** A link that carries a button's weight — real navigation, same shape. */
export function ButtonLink({
  variant = "secondary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClasses(variant, className)} {...props} />;
}

const fieldBase =
  "w-full rounded-field border border-line-12 bg-white px-[11px] py-2 text-sm text-ink outline-none transition-colors hover:border-line-22 focus-visible:border-brand focus-visible:shadow-[0_0_0_3px_rgb(23_131_92_/_0.14)] placeholder:text-muted-2";

export function Field({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cn(fieldBase, className)} {...props} />;
}

export function Select({ className, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cn(fieldBase, "cursor-pointer pr-[30px]", className)} {...props} />;
}

export function TextArea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cn(fieldBase, "resize-y", className)} {...props} />;
}

export function Label({ children, htmlFor }: { children: ReactNode; htmlFor?: string }) {
  return (
    <label htmlFor={htmlFor} className="mb-[5px] block text-[11.5px] font-medium text-muted">
      {children}
    </label>
  );
}

export function Pill({ className, ...props }: HTMLAttributes<HTMLSpanElement>) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-[5px] rounded-full px-[9px] py-[3px] text-xs font-medium",
        className,
      )}
      {...props}
    />
  );
}

/** The small amber dot that marks an upcoming cell. */
export function UpcomingDot({ className }: { className?: string }) {
  return (
    <i
      aria-hidden="true"
      className={cn("block size-[9px] shrink-0 rounded-full bg-amber", className)}
    />
  );
}

export function PageHeading({
  title,
  subtitle,
  actions,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-[26px] flex flex-wrap items-end gap-5">
      <div>
        <h1 className="mb-[5px] text-[30px] font-semibold tracking-[-0.022em]">{title}</h1>
        {subtitle ? <p className="text-[15px] text-muted">{subtitle}</p> : null}
      </div>
      {actions ? <div className="ml-auto flex items-center gap-[9px]">{actions}</div> : null}
    </div>
  );
}

/**
 * The app can now fail, which it never could when everything lived in the
 * browser. One shape for saying so, so eight screens do not each invent their
 * own.
 */
export function Notice({
  tone,
  children,
}: {
  tone: "error" | "success" | "info";
  children: ReactNode;
}) {
  const palette = {
    error: "border-amber/45 bg-amber-tint text-amber-ink",
    success: "border-brand/30 bg-brand-tint text-brand-deep",
    info: "border-line-13 bg-surface text-muted",
  }[tone];

  return (
    <p
      role={tone === "error" ? "alert" : "status"}
      className={cn("rounded-field border px-[13px] py-2.5 text-[13px]", palette)}
    >
      {children}
    </p>
  );
}

/** What a screen shows while it waits for the server. */
export function Loading({ label = "Loading…" }: { label?: string }) {
  return (
    <p role="status" className="py-8 text-center text-[13px] text-muted">
      {label}
    </p>
  );
}

/** What a list shows when there is genuinely nothing in it yet. */
export function Empty({ children }: { children: ReactNode }) {
  return <p className="px-5 py-6 text-center text-[13px] text-muted">{children}</p>;
}
