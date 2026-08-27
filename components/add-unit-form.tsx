"use client";

import { useId, useState, type FormEvent } from "react";
import { useCreateUnit } from "@/components/hooks";
import { Button, Card, Field, Label, Notice } from "@/components/ui";
import { ApiError } from "@/lib/api";

export function AddUnitForm({ onClose }: { onClose: () => void }) {
  const ids = useId();
  const create = useCreateUnit();
  const [label, setLabel] = useState("");
  const [floor, setFloor] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (label.trim() === "") return;
    try {
      await create.mutateAsync({ label, floor });
      setLabel("");
      setFloor("");
      onClose();
    } catch {
      /* The error renders below; the form stays open so nothing is retyped. */
    }
  }

  return (
    <Card className="mb-6 border-brand/30 bg-white px-[19px] pt-[17px] pb-[19px]">
      <form onSubmit={submit}>
        <h2 className="mb-3.5 text-[15px] font-semibold">Add a unit</h2>
        <div className="flex flex-wrap items-end gap-[13px]">
          <div className="w-[148px]">
            <Label htmlFor={`${ids}-label`}>Unit name</Label>
            <Field
              id={`${ids}-label`}
              value={label}
              placeholder="F2(B)"
              onChange={(e) => setLabel(e.target.value)}
            />
          </div>
          <div className="w-[196px]">
            <Label htmlFor={`${ids}-floor`}>Where it is</Label>
            <Field
              id={`${ids}-floor`}
              value={floor}
              placeholder="Second floor, back"
              onChange={(e) => setFloor(e.target.value)}
            />
          </div>
          <Button type="submit" variant="primary" disabled={label.trim() === "" || create.isPending}>
            {create.isPending ? "Adding…" : "Add the unit"}
          </Button>
          <Button type="button" onClick={onClose}>
            Cancel
          </Button>
        </div>
        {create.error ? (
          <div className="mt-3">
            <Notice tone="error">
              {create.error instanceof ApiError ? create.error.message : "Could not add that unit."}
            </Notice>
          </div>
        ) : null}
        <p className="mt-3 text-[13px] text-muted">
          A unit is just the room. Assign a tenant to it once both exist.
        </p>
      </form>
    </Card>
  );
}
