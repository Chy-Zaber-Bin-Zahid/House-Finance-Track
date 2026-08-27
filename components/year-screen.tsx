"use client";

import { useState } from "react";
import { AddUnitForm } from "@/components/add-unit-form";
import { useHouse } from "@/components/house-store";
import { PlusIcon } from "@/components/icons";
import { Button, ButtonLink, PageHeading } from "@/components/ui";
import { YearOverview } from "@/components/year-overview";
import { YearSheet } from "@/components/year-sheet";
import { yearHeadline } from "@/lib/derive";
import { downloadCsv, sheetToCsv } from "@/lib/export";

export function YearScreen() {
  const { state, config, lastMonth } = useHouse();
  const [formOpen, setFormOpen] = useState(false);

  return (
    <section aria-label="The year">
      <PageHeading
        title={`Bills and rent, ${config.yearLabel}`}
        subtitle={yearHeadline(state, config.currency)}
        actions={
          <>
            <Button
              onClick={() =>
                downloadCsv(
                  `bills-and-rent-${config.yearLabel}.csv`,
                  sheetToCsv(state),
                )
              }
            >
              Export to Excel
            </Button>
            <Button onClick={() => setFormOpen(true)}>
              <PlusIcon className="size-3.5" />
              Add a unit
            </Button>
            <ButtonLink variant="primary" href={`/month/${lastMonth + 1}`}>
              Fill in a month
            </ButtonLink>
          </>
        }
      />

      {formOpen ? (
        <AddUnitForm
          onClose={() => setFormOpen(false)}
          submitLabel="Add the column"
          hint="It joins the sheet as a new rent column, upcoming and empty for every month until you fill it in."
        />
      ) : null}

      <YearOverview />
      <YearSheet />

      <p className="mt-4 text-[13px] text-muted-2">Click a month, or a bar, to fill it in.</p>
    </section>
  );
}
