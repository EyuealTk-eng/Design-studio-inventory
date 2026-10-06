import type { Metadata } from "next";
import Link from "next/link";
import { AlertTriangle, Boxes, Download, FileUp, PackagePlus, Plus, Search } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { isLowStock, type Item } from "@/lib/types";
import {
  Badge,
  ButtonLink,
  Card,
  EmptyState,
  Input,
  PageHeader,
  Select,
  StockMeter,
  buttonClass,
  cx,
} from "@/components/ui";

export const metadata: Metadata = { title: "Inventory" };

export default async function InventoryPage({ searchParams }: PageProps<"/inventory">) {
  const profile = await requireUser();
  const isAdmin = profile.role === "admin";
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const category = typeof sp.category === "string" ? sp.category : "";
  const filter = typeof sp.filter === "string" ? sp.filter : "";

  const supabase = await createClient();
  const { data } = await supabase.from("items").select("*").order("category").order("name");
  const all = (data ?? []) as Item[];
  const categories = [...new Set(all.map((i) => i.category))].sort();

  const needle = q.toLowerCase();
  const items = all.filter(
    (i) =>
      (!needle ||
        [i.name, i.sku, i.location, i.category].some((f) => f?.toLowerCase().includes(needle))) &&
      (!category || i.category === category) &&
      (filter !== "low" || isLowStock(i)) &&
      (filter !== "out" || i.available_qty < i.total_qty),
  );
  const lowCount = all.filter(isLowStock).length;

  const chip = (value: string, label: string) => {
    const params = new URLSearchParams({ ...(q && { q }), ...(category && { category }), ...(value && { filter: value }) });
    return (
      <Link
        href={`/inventory?${params}`}
        aria-current={filter === value ? "true" : undefined}
        className={cx(
          "inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-semibold ring-1 ring-inset transition-colors",
          filter === value ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-muted ring-line hover:text-ink",
        )}
      >
        {label}
      </Link>
    );
  };

  return (
    <>
      <PageHeader
        title="Inventory"
        description={`${all.length} items across ${categories.length} categories`}
        actions={
          isAdmin ? (
            <>
              {/* File download from a route handler, not a page navigation. */}
              {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
              <a href="/api/export/inventory" className={buttonClass("secondary")}>
                <Download className="size-4" aria-hidden /> Export Excel
              </a>
              <ButtonLink href="/inventory/import" variant="secondary">
                <FileUp className="size-4" aria-hidden /> Import
              </ButtonLink>
              <ButtonLink href="/inventory/new">
                <Plus className="size-4" aria-hidden /> Add item
              </ButtonLink>
            </>
          ) : (
            <ButtonLink href="/requests/new">
              <PackagePlus className="size-4" aria-hidden /> Borrow items
            </ButtonLink>
          )
        }
      />

      {isAdmin && lowCount > 0 && filter !== "low" && (
        <Link
          href="/inventory?filter=low"
          className="mb-4 flex items-center gap-3 rounded-2xl border border-warn/20 bg-warn-bg px-4 py-3 text-sm font-medium text-warn hover:underline"
        >
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          {lowCount} item{lowCount === 1 ? " is" : "s are"} at or below the low-stock level — view items to reorder
        </Link>
      )}

      <Card className="overflow-hidden">
        <form className="flex flex-col gap-3 border-b border-line p-4 sm:flex-row" role="search">
          {filter && <input type="hidden" name="filter" value={filter} />}
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
            <Input name="q" defaultValue={q} placeholder="Search name, code or location…" aria-label="Search items" className="pl-10" />
          </div>
          <Select name="category" defaultValue={category} aria-label="Category" className="sm:w-56">
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </Select>
          <button type="submit" className={buttonClass("secondary")}>
            Apply
          </button>
        </form>
        <div className="flex flex-wrap gap-2 border-b border-line px-4 py-3">
          {chip("", "All")}
          {chip("low", `Low stock (${lowCount})`)}
          {chip("out", "Currently borrowed")}
        </div>

        {items.length === 0 ? (
          <EmptyState icon={<Boxes className="size-6" />} title={all.length === 0 ? "No items yet" : "No items match"}>
            {all.length === 0 && isAdmin ? "Add items one by one or import your Excel sheet." : "Try a different search or filter."}
          </EmptyState>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  <th scope="col" className="px-4 py-3">Item</th>
                  <th scope="col" className="hidden px-4 py-3 sm:table-cell">Category</th>
                  <th scope="col" className="hidden px-4 py-3 md:table-cell">Location</th>
                  <th scope="col" className="px-4 py-3">Available</th>
                  <th scope="col" className="hidden px-4 py-3 lg:table-cell">Condition</th>
                  <th scope="col" className="px-4 py-3"><span className="sr-only">Actions</span></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-brand-50/40">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-ink">{item.name}</p>
                      <p className="text-xs text-muted">
                        {item.sku && <span className="font-mono">{item.sku}</span>}
                        <span className="sm:hidden">{item.sku && " · "}{item.category}</span>
                      </p>
                    </td>
                    <td className="hidden px-4 py-3 sm:table-cell"><Badge tone="gray">{item.category}</Badge></td>
                    <td className="hidden px-4 py-3 text-muted md:table-cell">{item.location ?? "—"}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1 sm:flex-row sm:items-center sm:gap-2">
                        <StockMeter available={item.available_qty} total={item.total_qty} threshold={item.low_stock_threshold} />
                        {item.available_qty === 0 ? (
                          <Badge tone="red">Out</Badge>
                        ) : isLowStock(item) ? (
                          <Badge tone="amber">Low</Badge>
                        ) : null}
                      </div>
                    </td>
                    <td className="hidden px-4 py-3 text-muted lg:table-cell">{item.condition}</td>
                    <td className="px-4 py-3 text-right">
                      {isAdmin ? (
                        <Link href={`/inventory/${item.id}`} className="font-semibold text-brand-700 hover:underline">
                          Manage<span className="sr-only"> {item.name}</span>
                        </Link>
                      ) : item.available_qty > 0 ? (
                        <Link href={`/requests/new?item=${item.id}`} className="font-semibold text-brand-700 hover:underline">
                          Borrow<span className="sr-only"> {item.name}</span>
                        </Link>
                      ) : (
                        <span className="text-xs text-muted">Unavailable</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}
