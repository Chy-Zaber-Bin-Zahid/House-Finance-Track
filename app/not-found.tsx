import { ButtonLink } from "@/components/ui";

export const metadata = { title: "Not found" };

export default function NotFound() {
  return (
    <section className="py-10">
      <h1 className="mb-2 text-[30px] font-semibold tracking-[-0.022em]">
        That page is not on the sheet
      </h1>
      <p className="mb-5 text-[15px] text-muted">
        The link may be old, or the month may be out of range.
      </p>
      <ButtonLink variant="primary" href="/">
        Back to the year
      </ButtonLink>
    </section>
  );
}
