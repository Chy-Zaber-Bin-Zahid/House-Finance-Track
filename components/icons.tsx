import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Shared stroke geometry for the line icons. */
function Line({ className = "size-4", ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      className={className}
      {...props}
    />
  );
}

export function HouseIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M3 11l9-7 9 7" />
      <path d="M5 10v10h14V10" />
    </Line>
  );
}

export function PlusIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M12 5v14M5 12h14" />
    </Line>
  );
}

export function ChevronRightIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M9 5l7 7-7 7" />
    </Line>
  );
}

export function ChevronLeftIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M15 5l-7 7 7 7" />
    </Line>
  );
}

export function UploadIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M12 16V4M8 8l4-4 4 4" />
      <path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" />
    </Line>
  );
}

export function ImageFileIcon(props: IconProps) {
  return (
    <Line {...props}>
      <rect x="3" y="5" width="18" height="14" rx="2" />
      <circle cx="9" cy="11" r="1.6" />
      <path d="M3 17l5-4 4 3 3-2 6 5" />
    </Line>
  );
}

export function DocFileIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" />
      <path d="M14 3v5h5" />
    </Line>
  );
}

/** The filled green tick that marks a paid cell. */
export function PaidTickIcon({ className = "size-3.5", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} {...props}>
      <circle cx="8" cy="8" r="8" fill="#e3f3ea" />
      <path
        d="M4.6 8.3l2.1 2.1 4.7-4.7"
        stroke="#17835c"
        strokeWidth={1.8}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** The bare check used inside the "Paid" pill, which supplies its own tint. */
export function CheckIcon({ className = "size-3", ...props }: IconProps) {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" className={className} {...props}>
      <path
        d="M3.4 8.4l2.6 2.6 6-6"
        stroke="#17835c"
        strokeWidth={2}
        fill="none"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M2 12s3.6-6.5 10-6.5S22 12 22 12s-3.6 6.5-10 6.5S2 12 2 12Z" />
      <circle cx="12" cy="12" r="2.75" />
    </Line>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M10.6 6.2A9.9 9.9 0 0 1 12 5.5c6.4 0 10 6.5 10 6.5a17 17 0 0 1-3.3 4.05" />
      <path d="M6.4 7.9A16.7 16.7 0 0 0 2 12s3.6 6.5 10 6.5a10 10 0 0 0 3.9-.75" />
      <path d="m9.9 9.9a3 3 0 0 0 4.2 4.2" />
      <path d="m3 3 18 18" />
    </Line>
  );
}

export function MenuIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M4 7h16M4 12h16M4 17h16" />
    </Line>
  );
}

export function CloseIcon(props: IconProps) {
  return (
    <Line {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Line>
  );
}
