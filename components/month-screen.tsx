"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { EntryRow } from "@/components/entry-row";
import { useHouse } from "@/components/house-store";
import { ButtonLink, Card, PageHeading, Select } from "@/components/ui";
import { monthBillTotal, monthRentTotal, monthSummary } from "@/lib/derive";
import { formatAmount, parseAmount } from "@/lib/format";
import { BILL_KINDS, MONTH_NAMES } from "@/lib/seed";

function SectionCard({
  title,
  total,
  children,
}: {
  title: string;
  total: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="px-[22px] pt-[19px] pb-[21px]">
      <div className="mb-3.5 flex items-baseline gap-2.5">
        <h2 className="text-[17px] font-semibold">{title}</h2>
        <span className="num ml-auto text-[21px] font-semibold">{total}</span>
      </div>
      <div className="flex flex-col gap-[11px]">{children}</div>
    </Card>
  );
}

function Total({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className="mb-1 text-[12.5px] font-medium text-muted">{label}</div>
      <div
        className={`num text-left text-[27px] font-semibold tracking-[-0.024em] ${
          accent ? "text-brand" : ""
        }`}
      >
        {value}
      </div>
    </div>
  );
}

export function MonthScreen({ month }: { month: number }) {
  const { state, config, dispatch, rememberMonth } = useHouse();
  const router = useRouter();

  useEffect(() => {
    rememberMonth(month);
  }, [month, rememberMonth]);

  const bills = monthBillTotal(state, month);
  const rent = monthRentTotal(state, month);
  const currency = config.currency;

  return (
    <section aria-label="One month">
      <PageHeading
        title={`${MONTH_NAMES[month]} ${config.yearLabel}`}
        subtitle={monthSummary(state, month, currency)}
        actions={
          <>
            <label className="sr-only" htmlFor="month-picker">
              Pick a month
            </label>
            <Select
              id="month-picker"
              className="w-auto"
              value={month}
              onChange={(e) => router.push(`/month/${Number(e.target.value) + 1}`)}
            >
              {MONTH_NAMES.map((name, i) => (
                <option key={name} value={i}>
                  {name}
                </option>
              ))}
            </Select>
            <ButtonLink href="/">Back to the year</ButtonLink>
          </>
        }
      />

      <div className="grid grid-cols-[repeat(auto-fit,minmax(380px,1fr))] items-start gap-6">
        <SectionCard title="Bills" total={formatAmount(bills, currency)}>
          {BILL_KINDS.map((bill, i) => (
            <EntryRow
              key={bill.key}
              label={bill.label}
              entry={state.bills[month][i]}
              placeholder="0"
              onAmountChange={(value) =>
                dispatch({ type: "setBillAmount", month, bill: i, amount: parseAmount(value) })
              }
              onStatusChange={(status) =>
                dispatch({ type: "setBillStatus", month, bill: i, status })
              }
            />
          ))}
        </SectionCard>

        <SectionCard title="Rent" total={formatAmount(rent, currency)}>
          {state.units.length === 0 ? (
            <p className="text-[13px] text-muted-2">
              No units yet. Add one from the year sheet and it shows up here.
            </p>
          ) : (
            state.units.map((unit) => (
              <EntryRow
                key={unit.key}
                label={unit.label}
                boldLabel
                entry={unit.rent[month]}
                placeholder={unit.expected ? String(unit.expected) : "0"}
                onAmountChange={(value) =>
                  dispatch({
                    type: "setRentAmount",
                    month,
                    unitKey: unit.key,
                    amount: parseAmount(value),
                  })
                }
                onStatusChange={(status) =>
                  dispatch({ type: "setRentStatus", month, unitKey: unit.key, status })
                }
              />
            ))
          )}
        </SectionCard>
      </div>

      <Card className="mt-6 flex flex-wrap items-center gap-[34px] px-6 py-5">
        <Total label="Rent this month" value={formatAmount(rent, currency)} />
        <Total label="Bills this month" value={formatAmount(bills, currency)} />
        <Total label="Left over" value={formatAmount(rent - bills, currency)} accent />
        <ButtonLink variant="primary" href="/" className="ml-auto">
          Done
        </ButtonLink>
      </Card>
    </section>
  );
}
