import "server-only";
import ExcelJS from "exceljs";
import { z } from "zod";

/** One row of an inventory import, after header mapping and validation. */
export const importRowSchema = z.object({
  name: z.string().trim().min(1, "Name is required").max(200),
  category: z.string().trim().max(100).default("General"),
  sku: z.string().trim().max(100).nullable().default(null),
  location: z.string().trim().max(200).nullable().default(null),
  condition: z.string().trim().max(100).default("Good"),
  total_qty: z.number().int("Quantity must be a whole number").min(0).max(1_000_000),
  available_qty: z.number().int().min(0).nullable().default(null),
  low_stock_threshold: z.number().int().min(0).default(2),
  notes: z.string().trim().max(1000).nullable().default(null),
});
export type ImportRow = z.infer<typeof importRowSchema>;

export interface ParsedImport {
  rows: ImportRow[];
  errors: { line: number; message: string }[];
  unmappedHeaders: string[];
}

// Header aliases (lower-cased, punctuation stripped) → field.
const HEADER_MAP: Record<string, keyof ImportRow> = {
  name: "name", item: "name", itemname: "name", description: "name", equipment: "name",
  category: "category", type: "category", group: "category",
  sku: "sku", code: "sku", itemcode: "sku", id: "sku", assettag: "sku", serial: "sku",
  location: "location", shelf: "location", storage: "location",
  condition: "condition", status: "condition",
  quantity: "total_qty", qty: "total_qty", total: "total_qty", totalqty: "total_qty",
  totalquantity: "total_qty", amount: "total_qty", stock: "total_qty",
  available: "available_qty", availableqty: "available_qty", instock: "available_qty",
  lowstock: "low_stock_threshold", threshold: "low_stock_threshold",
  reorderlevel: "low_stock_threshold", minimum: "low_stock_threshold", min: "low_stock_threshold",
  notes: "notes", note: "notes", remarks: "notes", comment: "notes",
};

const NUMERIC: (keyof ImportRow)[] = ["total_qty", "available_qty", "low_stock_threshold"];

function normaliseHeader(h: string) {
  return h.toLowerCase().replace(/[^a-z]/g, "");
}

function cellText(value: ExcelJS.CellValue): string {
  if (value == null) return "";
  if (typeof value === "object") {
    if ("result" in value) return cellText(value.result as ExcelJS.CellValue);
    if ("text" in value) return String(value.text);
    if ("richText" in value) return value.richText.map((r) => r.text).join("");
    if (value instanceof Date) return value.toISOString().slice(0, 10);
  }
  return String(value);
}

/** Minimal RFC-4180 CSV parser (quoted fields, escaped quotes, CRLF). */
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length > 0) { row.push(field); rows.push(row); }
  return rows;
}

async function readGrid(file: File): Promise<string[][]> {
  const buf = await file.arrayBuffer();
  if (file.name.toLowerCase().endsWith(".csv")) {
    return parseCsv(new TextDecoder().decode(buf).replace(/^﻿/, ""));
  }
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buf);
  const sheet = wb.worksheets[0];
  if (!sheet) return [];
  const grid: string[][] = [];
  sheet.eachRow({ includeEmpty: false }, (row) => {
    const values: string[] = [];
    for (let c = 1; c <= sheet.columnCount; c++) values.push(cellText(row.getCell(c).value).trim());
    grid.push(values);
  });
  return grid;
}

export async function parseInventoryFile(file: File): Promise<ParsedImport> {
  const grid = (await readGrid(file)).filter((r) => r.some((v) => v.trim() !== ""));
  if (grid.length === 0) return { rows: [], errors: [{ line: 1, message: "The file is empty" }], unmappedHeaders: [] };

  const headers = grid[0];
  const fields = headers.map((h) => HEADER_MAP[normaliseHeader(h)]);
  const unmappedHeaders = headers.filter((h, i) => h && !fields[i]);
  if (!fields.includes("name") || !fields.includes("total_qty")) {
    return {
      rows: [],
      errors: [{ line: 1, message: 'The first row must have headers including "Name" and "Quantity"' }],
      unmappedHeaders,
    };
  }

  const rows: ImportRow[] = [];
  const errors: ParsedImport["errors"] = [];
  grid.slice(1).forEach((values, idx) => {
    const raw: Record<string, unknown> = {};
    fields.forEach((field, col) => {
      if (!field || raw[field] !== undefined) return;
      const v = (values[col] ?? "").trim();
      if (v === "") return;
      raw[field] = NUMERIC.includes(field) ? Number(v.replace(/,/g, "")) : v;
    });
    const parsed = importRowSchema.safeParse(raw);
    if (parsed.success) rows.push(parsed.data);
    else errors.push({ line: idx + 2, message: parsed.error.issues.map((i) => `${String(i.path[0] ?? "")}: ${i.message}`).join("; ") });
  });
  return { rows, errors, unmappedHeaders };
}

/** Builds an .xlsx workbook from named sheets of plain objects. */
export async function buildWorkbook(
  sheets: { name: string; rows: Record<string, string | number | null>[] }[],
): Promise<ArrayBuffer> {
  const wb = new ExcelJS.Workbook();
  wb.creator = "Biomedical Design Studio Inventory";
  for (const s of sheets) {
    const ws = wb.addWorksheet(s.name);
    const cols = Object.keys(s.rows[0] ?? { "(empty)": "" });
    ws.columns = cols.map((key) => ({ header: key, key, width: Math.max(12, key.length + 4) }));
    ws.getRow(1).font = { bold: true, color: { argb: "FFFFFFFF" } };
    ws.getRow(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } };
    s.rows.forEach((r) => ws.addRow(r));
    ws.views = [{ state: "frozen", ySplit: 1 }];
  }
  return (await wb.xlsx.writeBuffer()) as ArrayBuffer;
}
