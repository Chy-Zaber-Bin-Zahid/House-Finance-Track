"use client";

import Link from "next/link";
import { useState } from "react";
import { useMe, useSheet, useUnlockYear } from "@/components/hooks";
import { useViewState } from "@/components/view-state";
import { Button, ButtonLink, Card, Loading, Notice, PageHeading, Select } from "@/components/ui";
import { YearOverview } from "@/components/year-overview";
import { YearSheet } from "@/components/year-sheet";
import { HOUSE_CONFIG } from "@/lib/config";
import { downloadCsv, sheetToCsv } from "@/lib/export";
import { formatAmount } from "@/lib/format";
import { upcomingCount } from "@/lib/sheet";
import { ApiError } from "@/lib/api";

export function YearScreen() {
  const year = useViewState((s) => s.year);
  const setYear = useViewState((s) => s.setYear);
  const { data, isPending, error, refetch } = useSheet(year);
  const { data: me } = useMe(year);
  const unlock = useUnlockYear();
  const [billName, setBillName] = useState("");

  const currency = HOUSE_CONFIG.currency;
  /* The server owns this rule and answers with its own clock. */
  const editable = me?.year?.editable ?? false;
  const canUnlock = me?.year?.canUnlock ?? false;
  const isCurrent = me?.year?.isCurrent ?? false;

  if (isPending) return <Loading label="Loading the sheet…" />;

  if (error) {
    return (
      <section aria-label="The year">
        <PageHeading title={`Bills and rent, ${year}`} />
        <Notice tone="error">
          {error instanceof ApiError ? error.message : "Could not load the sheet."}{" "}
          <button type="button" onClick={() => void refetch()} className="underline">
            Try again
          </button>
        </Notice>
      </section>
    );
  }

  const { sheet, totals, years, currentYear } = data;
  const left = upcomingCount(sheet);
  const offered = [...new Set([currentYear, ...years, year])].sort((a, b) => b - a);

  return (
    <section aria-label="The year">
      <PageHeading
        title={`Bills and rent, ${year}`}
        subtitle={`You kept ${formatAmount(totals.kept, currency)} this year. ${
          left === 0
            ? "Everything is marked paid."
            : `${left} ${left === 1 ? "cell is" : "cells are"} still upcoming.`
        }`}
        actions={
          <>
            <label className="sr-only" htmlFor="year-picker">
              Year
            </label>
            <Select
              id="year-picker"
              className="w-auto"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            >
              {offered.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </Select>
            <Button onClick={() => downloadCsv(`bills-and-rent-${year}.csv`, sheetToCsv(sheet, currency))}>
              Export to Excel
            </Button>
            <ButtonLink
              variant="primary"
              href={`/month/${year}/${isCurrent ? new Date().getMonth() + 1 : 1}`}
            >
              Fill in a month
            </ButtonLink>
          </>
        }
      />

      {!editable ? (
        <div className="mb-5">
          <Notice tone="info">
            {year} is read-only.{" "}
            {canUnlock ? (
              <button
                type="button"
                className="font-medium text-brand underline"
                onClick={() => unlock.mutate(year)}
                disabled={unlock.isPending}
              >
                {unlock.isPending ? "Unlocking…" : `Unlock ${year} for this session`}
              </button>
            ) : (
              "Ask the owner if something needs correcting."
            )}
          </Notice>
        </div>
      ) : null}

      {unlock.error ? (
        <div className="mb-5">
          <Notice tone="error">
            {unlock.error instanceof ApiError ? unlock.error.message : "Could not unlock that year."}
          </Notice>
        </div>
      ) : null}

      <YearOverview sheet={sheet} totals={totals} />
      <YearSheet sheet={sheet} totals={totals} />

      {sheet.units.length === 0 && sheet.billTypes.length === 0 ? (
        <Card className="mt-4 px-5 py-6">
          <p className="text-center text-[13px] text-muted">
            Nothing to show yet. Add a unit and a tenant on{" "}
            <Link href="/units">Units &amp; tenants</Link>, then add a bill below.
          </p>
        </Card>
      ) : null}

      <p className="mt-4 text-[13px] text-muted-2">Click a month, or a bar, to fill it in.</p>
    </section>
  );
}
