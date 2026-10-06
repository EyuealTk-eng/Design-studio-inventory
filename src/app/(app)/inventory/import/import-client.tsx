"use client";

import { useActionState, useState, useTransition } from "react";
import Link from "next/link";
import { CheckCircle2, Download, FileSpreadsheet, Loader2, UploadCloud } from "lucide-react";
import { commitImport, previewImport, type ImportResult } from "../actions";
import type { ParsedImport } from "@/lib/excel";
import { Alert, Button, ButtonLink, Card, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function ImportClient() {
  const [preview, previewAction] = useActionState<ParsedImport | null, FormData>(previewImport, null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [fileName, setFileName] = useState("");
  const [dragging, setDragging] = useState(false);
  const [saving, startSaving] = useTransition();

  if (result && !result.error) {
    return (
      <Card className="flex flex-col items-center gap-4 p-10 text-center">
        <CheckCircle2 className="size-12 text-ok" aria-hidden />
        <p className="text-lg font-semibold">
          Import complete: {result.created} added, {result.updated} updated.
        </p>
        <ButtonLink href="/inventory">View inventory</ButtonLink>
      </Card>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Card className="p-6">
        <form action={previewAction} className="flex flex-col gap-4">
          <label
            htmlFor="file"
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={() => setDragging(false)}
            className={cx(
              "relative flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
              dragging ? "border-brand-500 bg-brand-50" : "border-brand-200 hover:border-brand-400 hover:bg-brand-50/50",
            )}
          >
            <UploadCloud className="size-10 text-brand-500" aria-hidden />
            <span className="font-semibold">{fileName || "Drop your Excel file here, or click to choose"}</span>
            <span className="text-sm text-muted">
              Headers needed: <b>Name</b> and <b>Quantity</b>. Optional: Category, Code, Location, Condition, Low stock, Notes.
            </span>
            <input
              id="file"
              name="file"
              type="file"
              accept=".xlsx,.csv"
              required
              className="absolute inset-0 cursor-pointer opacity-0"
              onChange={(e) => setFileName(e.target.files?.[0]?.name ?? "")}
            />
          </label>
          <div className="flex flex-wrap gap-2">
            <SubmitButton pendingText="Reading file…">
              <FileSpreadsheet className="size-4" aria-hidden /> Preview import
            </SubmitButton>
            {/* File download from a route handler, not a page navigation. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/export/template" className="inline-flex min-h-11 items-center gap-2 px-2 text-sm font-semibold text-brand-700 hover:underline">
              <Download className="size-4" aria-hidden /> Download template
            </a>
          </div>
        </form>
      </Card>

      {preview && (
        <Card className="overflow-hidden">
          <div className="flex flex-col gap-3 border-b border-line p-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="font-semibold">Preview</h2>
              <p className="text-sm text-muted">
                {preview.rows.length} valid row{preview.rows.length === 1 ? "" : "s"}
                {preview.errors.length > 0 && `, ${preview.errors.length} skipped`}. Existing items with the same code or name will be updated.
              </p>
            </div>
            {preview.rows.length > 0 && (
              <Button
                type="button"
                disabled={saving}
                onClick={() =>
                  startSaving(async () => setResult(await commitImport(JSON.stringify(preview.rows))))
                }
              >
                {saving && <Loader2 className="size-4 animate-spin" aria-hidden />}
                {saving ? "Importing…" : `Import ${preview.rows.length} items`}
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-3 p-5">
            {result?.error && <Alert>{result.error}</Alert>}
            {preview.errors.length > 0 && (
              <Alert>
                <ul className="list-inside list-disc">
                  {preview.errors.slice(0, 10).map((e) => (
                    <li key={`${e.line}-${e.message}`}>
                      {e.line > 0 && `Row ${e.line}: `}
                      {e.message}
                    </li>
                  ))}
                  {preview.errors.length > 10 && <li>…and {preview.errors.length - 10} more</li>}
                </ul>
              </Alert>
            )}
            {preview.unmappedHeaders.length > 0 && (
              <Alert tone="blue">Ignored columns: {preview.unmappedHeaders.join(", ")}</Alert>
            )}
          </div>
          {preview.rows.length > 0 && (
            <div className="max-h-[28rem] overflow-auto border-t border-line">
              <table className="w-full text-left text-sm">
                <thead className="sticky top-0 bg-surface text-xs font-semibold uppercase tracking-wide text-muted">
                  <tr>
                    {["Name", "Category", "Code", "Qty", "Low at", "Location", "Condition"].map((h) => (
                      <th key={h} scope="col" className="px-4 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {preview.rows.map((r, i) => (
                    <tr key={i}>
                      <td className="px-4 py-2 font-medium">{r.name}</td>
                      <td className="px-4 py-2">{r.category}</td>
                      <td className="px-4 py-2 font-mono text-xs">{r.sku ?? "—"}</td>
                      <td className="px-4 py-2 tabular-nums">{r.total_qty}</td>
                      <td className="px-4 py-2 tabular-nums">{r.low_stock_threshold}</td>
                      <td className="px-4 py-2">{r.location ?? "—"}</td>
                      <td className="px-4 py-2">{r.condition}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}
      <p className="text-sm text-muted">
        <Link href="/inventory" className="font-semibold text-brand-700 hover:underline">← Back to inventory</Link>
      </p>
    </div>
  );
}
