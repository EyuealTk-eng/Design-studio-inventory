"use client";

import { useActionState } from "react";
import { saveItem, type ItemFormState } from "./actions";
import { Alert, ButtonLink, Field, Input, Select, Textarea } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import type { Item } from "@/lib/types";

const CONDITIONS = ["New", "Good", "Fair", "Needs repair", "Calibration due"];

export function ItemForm({ item, categories }: { item?: Item; categories: string[] }) {
  const [state, action] = useActionState<ItemFormState, FormData>(saveItem, {});
  const fe = state.fieldErrors ?? {};
  // After an error, show what was submitted; otherwise the saved item.
  const v = (key: keyof Item) => state.values?.[key] ?? (item?.[key] as string | number | null | undefined) ?? undefined;
  const borrowed = item ? item.total_qty - item.available_qty : 0;
  const condition = String(v("condition") ?? "Good");

  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && <Alert>{state.error}</Alert>}
      {item && <input type="hidden" name="id" value={item.id} />}
      <Field label="Item name" htmlFor="name" error={fe.name}>
        <Input id="name" name="name" defaultValue={v("name") ?? ""} required placeholder="e.g. Arduino Uno R3" />
      </Field>
      <div className="grid gap-5 sm:grid-cols-2">
        <Field label="Category" htmlFor="category" error={fe.category} hint="Pick an existing one or type a new one">
          <Input id="category" name="category" list="categories" defaultValue={v("category") ?? "General"} required />
          <datalist id="categories">
            {categories.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>
        </Field>
        <Field label="Code / SKU" htmlFor="sku" error={fe.sku} hint="Optional — printed on the QR label">
          <Input id="sku" name="sku" defaultValue={v("sku") ?? ""} className="font-mono" />
        </Field>
      </div>
      <div className="grid gap-5 sm:grid-cols-3">
        <Field
          label="Total quantity"
          htmlFor="total_qty"
          error={fe.total_qty}
          hint={borrowed ? `${borrowed} currently borrowed` : "How many the studio owns"}
        >
          <Input id="total_qty" name="total_qty" type="number" min={0} inputMode="numeric" defaultValue={v("total_qty") ?? 1} required />
        </Field>
        <Field label="Low-stock alert at" htmlFor="low_stock_threshold" error={fe.low_stock_threshold} hint="Alert when available ≤ this">
          <Input id="low_stock_threshold" name="low_stock_threshold" type="number" min={0} inputMode="numeric" defaultValue={v("low_stock_threshold") ?? 2} required />
        </Field>
        <Field label="Condition" htmlFor="condition" error={fe.condition}>
          <Select id="condition" name="condition" defaultValue={condition}>
            {[...new Set([...CONDITIONS, condition])].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
        </Field>
      </div>
      <Field label="Storage location" htmlFor="location" error={fe.location}>
        <Input id="location" name="location" defaultValue={v("location") ?? ""} placeholder="e.g. Cabinet B, shelf 2" />
      </Field>
      <Field label="Notes" htmlFor="notes" error={fe.notes}>
        <Textarea id="notes" name="notes" defaultValue={v("notes") ?? ""} />
      </Field>
      <div className="flex flex-wrap gap-2">
        <SubmitButton pendingText="Saving…">{item ? "Save changes" : "Add item"}</SubmitButton>
        <ButtonLink href="/inventory" variant="secondary">
          Cancel
        </ButtonLink>
      </div>
    </form>
  );
}
