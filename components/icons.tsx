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
