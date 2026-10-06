"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { importRowSchema, parseInventoryFile, type ImportRow, type ParsedImport } from "@/lib/excel";

export interface ItemFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: Record<string, string>;
}

function echo(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && !k.startsWith("$")) values[k] = v;
  return values;
}

const optional = z
  .string()
  .trim()
  .transform((v) => (v === "" ? null : v));

const itemSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  category: z.string().trim().min(1, "Category is required").max(100),
  sku: optional.pipe(z.string().max(100).nullable()),
  location: optional.pipe(z.string().max(200).nullable()),
  condition: z.string().trim().min(1).max(100),
  total_qty: z.coerce.number().int("Whole numbers only").min(0, "Can't be negative"),
  low_stock_threshold: z.coerce.number().int("Whole numbers only").min(0, "Can't be negative"),
  notes: optional.pipe(z.string().max(1000).nullable()),
});

export async function saveItem(_prev: ItemFormState, formData: FormData): Promise<ItemFormState> {
  await requireAdmin();
  const parsed = itemSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors, values: echo(formData) };
  }
  const supabase = await createClient();
  const id = String(formData.get("id") ?? "");
  const v = parsed.data;

  if (id) {
    const { total_qty, ...fields } = v;
    const { error } = await supabase.from("items").update(fields).eq("id", id);
    if (error) return { error: friendly(error.message), values: echo(formData) };
    const { error: qtyError } = await supabase.rpc("set_item_total", {
      p_id: id,
      p_total: total_qty,
      p_reason: "stock adjusted",
    });
    if (qtyError) return { fieldErrors: { total_qty: qtyError.message }, values: echo(formData) };
  } else {
    const { data, error } = await supabase
      .from("items")
      .insert({ ...v, available_qty: v.total_qty })
      .select("id")
      .single();
    if (error) return { error: friendly(error.message), values: echo(formData) };
    await supabase
      .from("stock_movements")
      .insert({ item_id: data.id, delta: v.total_qty, reason: "added" });
  }

  revalidatePath("/inventory");
  redirect("/inventory");
}

export async function deleteItem(formData: FormData) {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("items").delete().eq("id", String(formData.get("id")));
  if (error) {
    redirect(`/inventory/${formData.get("id")}?error=${encodeURIComponent(
      "This item appears in borrow history, so it can't be deleted. Set its quantity to 0 instead.",
    )}`);
  }
  revalidatePath("/inventory");
  redirect("/inventory");
}

function friendly(message: string) {
  if (message.includes("items_sku_key")) return "Another item already uses that code / SKU";
  return message;
}

// ------------------------------------------------------------------ import

export async function previewImport(
  _prev: ParsedImport | null,
  formData: FormData,
): Promise<ParsedImport> {
  await requireAdmin();
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return { rows: [], errors: [{ line: 0, message: "Choose an .xlsx or .csv file" }], unmappedHeaders: [] };
  }
  if (file.size > 5 * 1024 * 1024) {
    return { rows: [], errors: [{ line: 0, message: "File is larger than 5 MB" }], unmappedHeaders: [] };
  }
  if (!/\.(xlsx|csv)$/i.test(file.name)) {
    return { rows: [], errors: [{ line: 0, message: "Only .xlsx and .csv files are supported" }], unmappedHeaders: [] };
  }
  try {
    return await parseInventoryFile(file);
  } catch {
    return { rows: [], errors: [{ line: 0, message: "Could not read this file. Is it a valid Excel workbook?" }], unmappedHeaders: [] };
  }
}

export interface ImportResult {
  created: number;
  updated: number;
  error?: string;
}

/**
 * Applies previewed rows. Rows match existing items by SKU, then by name
 * (case-insensitive). Borrowed units stay deducted (see set_item_total).
 */
export async function commitImport(rowsJson: string): Promise<ImportResult> {
  await requireAdmin();
  const parsed = z.array(importRowSchema).max(5000).safeParse(JSON.parse(rowsJson));
  if (!parsed.success) return { created: 0, updated: 0, error: "Import data was invalid" };
  const rows: ImportRow[] = parsed.data;

  const supabase = await createClient();
  const { data: existing, error: loadError } = await supabase
    .from("items")
    .select("id, name, sku");
  if (loadError) return { created: 0, updated: 0, error: loadError.message };

  const bySku = new Map(existing.filter((i) => i.sku).map((i) => [i.sku!.toLowerCase(), i]));
  const byName = new Map(existing.map((i) => [i.name.toLowerCase(), i]));
  let created = 0;
  let updated = 0;

  for (const row of rows) {
    const match = (row.sku && bySku.get(row.sku.toLowerCase())) || byName.get(row.name.toLowerCase());
    const { available_qty, ...fields } = row;
    if (match) {
      const { total_qty, ...rest } = fields;
      const { error } = await supabase.from("items").update(rest).eq("id", match.id);
      if (error) return { created, updated, error: `${row.name}: ${friendly(error.message)}` };
      const { error: qtyError } = await supabase.rpc("set_item_total", {
        p_id: match.id,
        p_total: total_qty,
        p_reason: "excel import",
        p_clamp: true,
      });
      if (qtyError) return { created, updated, error: `${row.name}: ${qtyError.message}` };
      updated++;
    } else {
      const avail = Math.min(available_qty ?? row.total_qty, row.total_qty);
      const { data, error } = await supabase
        .from("items")
        .insert({ ...fields, available_qty: avail })
        .select("id, name, sku")
        .single();
      if (error) return { created, updated, error: `${row.name}: ${friendly(error.message)}` };
      await supabase.from("stock_movements").insert({ item_id: data.id, delta: avail, reason: "excel import" });
      byName.set(data.name.toLowerCase(), data);
      if (data.sku) bySku.set(data.sku.toLowerCase(), data);
      created++;
    }
  }

  revalidatePath("/inventory");
  return { created, updated };
}
