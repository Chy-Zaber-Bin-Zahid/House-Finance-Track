"use client";

import { useId, useState } from "react";
import { useHouse, type UnitDraft } from "@/components/house-store";
import { Button, Card, Field, Label } from "@/components/ui";

const EMPTY: UnitDraft = { label: "", floor: "", rent: "", name: "" };

export function AddUnitForm({
  onClose,
  submitLabel,
  hint,
}: {
  onClose: () => void;
  submitLabel: string;
  /** Explains what adding a unit does to the sheet, where there is room to say it. */
  hint?: string;
}) {
  const { dispatch } = useHouse();
  const [draft, setDraft] = useState<UnitDraft>(EMPTY);
  const ids = useId();

  const set = (field: keyof UnitDraft) => (value: string) =>
    setDraft((d) => ({ ...d, [field]: value }));

  const incomplete = draft.label.trim() === "";

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (incomplete) return;
    dispatch({ type: "addUnit", draft });
    setDraft(EMPTY);
    onClose();
  }

  const fields: {
    key: keyof UnitDraft;
    label: string;
    placeholder: string;
    width: string;
    numeric?: boolean;
  }[] = [
    { key: "label", label: "Unit name", placeholder: "F2(B)", width: "w-[148px]" },
    { key: "floor", label: "Where it is", placeholder: "Second floor, back", width: "w-[196px]" },
    { key: "rent", label: "Monthly rent", placeholder: "6000", width: "w-[142px]", numeric: true },
    {
      key: "name",
      label: "Tenant, if any",
      placeholder: "Leave blank if empty",
      width: "w-[186px]",
    },
  ];

  return (
    <Card className="mb-6 border-brand/30 bg-white px-[19px] pt-[17px] pb-[19px]">
      <form onSubmit={submit}>
        <h2 className="mb-3.5 text-[15px] font-semibold">Add a unit</h2>
        <div className="flex flex-wrap items-end gap-[13px]">
          {fields.map((f) => (
            <div key={f.key} className={f.width}>
              <Label htmlFor={`${ids}-${f.key}`}>{f.label}</Label>
              <Field
                id={`${ids}-${f.key}`}
                className={f.numeric ? "num" : undefined}
                inputMode={f.numeric ? "numeric" : undefined}
                value={draft[f.key]}
                placeholder={f.placeholder}
                onChange={(e) => set(f.key)(e.target.value)}
              />
            </div>
          ))}
          <Button type="submit" variant="primary" disabled={incomplete}>
            {submitLabel}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
        {hint ? <p className="mt-3 text-[13px] text-muted">{hint}</p> : null}
      </form>
    </Card>
  );
}
