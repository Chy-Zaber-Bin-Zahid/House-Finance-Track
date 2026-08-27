"use client";

import Link from "next/link";
import { useId, useState } from "react";
import { DocumentPanel } from "@/components/document-panel";
import { useHouse } from "@/components/house-store";
import { CheckIcon, ChevronLeftIcon } from "@/components/icons";
import { ImageSlot } from "@/components/image-slot";
import { ButtonLink, Card, Field, Label, Pill, TextArea, UpcomingDot } from "@/components/ui";
import { findUnit, unitMonthlyRent, unitYearTotal } from "@/lib/derive";
import { formatAmount, parseAmount } from "@/lib/format";
import { MONTH_NAMES } from "@/lib/seed";
import type { Unit } from "@/lib/types";

/** Lets the field go empty while you retype a figure, without booking a zero mid-keystroke. */
function MonthlyRentField({ unit }: { unit: Unit }) {
  const { dispatch } = useHouse();
  const id = useId();
  const [draft, setDraft] = useState(() => String(unitMonthlyRent(unit)));

  return (
    <div>
      <Label htmlFor={id}>Monthly rent</Label>
      <Field
        id={id}
        className="num"
        inputMode="numeric"
        value={draft}
        onChange={(e) => {
          setDraft(e.target.value);
          dispatch({
            type: "setMonthlyRent",
            unitKey: unit.key,
            amount: parseAmount(e.target.value),
          });
        }}
        onBlur={() => setDraft(String(unitMonthlyRent(unit)))}
      />
    </div>
  );
}

export function TenantScreen({ unitKey }: { unitKey: string }) {
  const { state, config, ready, dispatch } = useHouse();
  const unit = findUnit(state, unitKey);
  const nameId = useId();
  const phoneId = useId();
  const notesId = useId();

  if (!unit) {
    return (
      <section aria-label="Tenant profile">
        <h1 className="mb-2 text-[30px] font-semibold tracking-[-0.022em]">
          {ready ? "No such unit" : "Loading…"}
        </h1>
        {ready ? (
          <>
            <p className="mb-5 text-[15px] text-muted">
              This unit is not on the sheet. It may have been added on another device.
            </p>
            <ButtonLink href="/units">All units</ButtonLink>
          </>
        ) : null}
      </section>
    );
  }

  return (
    <section aria-label="Tenant profile">
      <ButtonLink href="/units" className="mb-5">
        <ChevronLeftIcon className="size-3.5" />
        All units
      </ButtonLink>

      <div className="grid grid-cols-1 items-start gap-[26px] lg:grid-cols-[312px_minmax(0,1fr)]">
        <Card className="px-[22px] pt-5 pb-[22px]">
          <ImageSlot
            id={`unit-${unit.key}`}
            placeholder="Drop a photo of this tenant"
            className="mb-[17px] aspect-square w-full rounded-tile"
          />

          <div className="mb-[18px] flex items-center gap-2.5">
            <h1 className="text-[22px] font-semibold tracking-[-0.02em]">{unit.label}</h1>
            <Pill className="bg-chip text-slate">{unit.floor}</Pill>
          </div>

          <div className="flex flex-col gap-[13px]">
            <div>
              <Label htmlFor={nameId}>Name</Label>
              <Field
                id={nameId}
                value={unit.name}
                onChange={(e) =>
                  dispatch({ type: "patchUnit", unitKey: unit.key, patch: { name: e.target.value } })
                }
              />
            </div>
            <div>
              <Label htmlFor={phoneId}>Phone</Label>
              <Field
                id={phoneId}
                type="tel"
                value={unit.phone}
                onChange={(e) =>
                  dispatch({
                    type: "patchUnit",
                    unitKey: unit.key,
                    patch: { phone: e.target.value },
                  })
                }
              />
            </div>
            <MonthlyRentField key={unit.key} unit={unit} />
          </div>

          <div className="mt-[18px] flex items-baseline justify-between border-t border-line-7 pt-4">
            <span className="text-[13px] text-muted">Collected {config.yearLabel}</span>
            <span className="num text-[19px] font-semibold">
              {formatAmount(unitYearTotal(unit), config.currency)}
            </span>
          </div>
        </Card>

        <div className="flex flex-col gap-6">
          <DocumentPanel unit={unit} />

          <Card className="px-[22px] pt-[19px] pb-2">
            <div className="mb-2.5 flex items-baseline gap-2.5">
              <h2 className="text-[17px] font-semibold">Rent, {config.yearLabel}</h2>
              <Link href="/" className="ml-auto text-[13px] font-medium text-brand hover:text-brand-hover">
                The whole sheet
              </Link>
            </div>
            <table className="w-full border-collapse">
              <caption className="sr-only">
                What {unit.label} paid each month of {config.yearLabel}
              </caption>
              <tbody>
                {unit.rent.map((entry, month) => (
                  <tr key={month} className="border-b border-line-5 last:border-b-0">
                    <th scope="row" className="w-[120px] p-[11px] pl-0 text-left text-sm font-normal">
                      <Link
                        href={`/month/${month + 1}`}
                        className="text-ink hover:text-brand"
                      >
                        {MONTH_NAMES[month]}
                      </Link>
                    </th>
                    <td className="num w-[130px] p-[11px] text-right text-sm">
                      {formatAmount(entry.amount, config.currency)}
                    </td>
                    <td className="p-[11px] text-sm">
                      {entry.status === "Paid" ? (
                        <Pill className="bg-brand-tint text-brand-deep">
                          <CheckIcon />
                          Paid
                        </Pill>
                      ) : (
                        <Pill className="bg-amber-tint text-amber-ink">
                          <UpcomingDot className="size-[7px]" />
                          Upcoming
                        </Pill>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="px-[22px] pt-[19px] pb-[22px]">
            <Label htmlFor={notesId}>
              <span className="text-[17px] font-semibold text-ink">Notes</span>
            </Label>
            <TextArea
              id={notesId}
              className="mt-3 min-h-[84px]"
              placeholder="Anything worth remembering about this tenant…"
              value={unit.notes}
              onChange={(e) =>
                dispatch({ type: "patchUnit", unitKey: unit.key, patch: { notes: e.target.value } })
              }
            />
          </Card>
        </div>
      </div>
    </section>
  );
}
