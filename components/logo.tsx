import Image from "next/image";
import mark from "@/public/logo-mark.png";
import lockup from "@/public/logo-full.png";

/**
 * The house mark on its own, for places that already name the house in text
 * beside it — decoration there, so it stays out of the accessibility tree.
 *
 * Both are static imports: Next reads the intrinsic size at build time, so the
 * header reserves the right box before the file arrives and nothing shifts.
 */
export function LogoMark({ className }: { className?: string }) {
  return <Image src={mark} alt="" aria-hidden className={className} priority />;
}

/** The full lockup, mark and wordmark together, where the logo is the heading. */
export function LogoLockup({ className }: { className?: string }) {
  return <Image src={lockup} alt="House Finance Track" className={className} priority />;
}
