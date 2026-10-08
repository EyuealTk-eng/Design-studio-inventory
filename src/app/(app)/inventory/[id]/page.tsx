import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import QRCode from "qrcode";
import { History, Trash2, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { env } from "@/lib/env";
import { dueLabel, formatDate, today } from "@/lib/dates";
import type { Item } from "@/lib/types";
import { Alert, Badge, Button, Card, PageHeader, StockMeter } from "@/components/ui";
import { ItemForm } from "../item-form";
import { PrintButton } from "@/components/print-button";
import { deleteItem } from "../actions";

export const metadata: Metadata = { title: "Manage item" };

interface Holder {
  qty: number;
  requests: {
    id: string;
    due_date: string;
    status: string;
    profiles: { full_name: string; student_id: string } | null;
  } | null;
}

export default async function ItemPage({ params, searchParams }: PageProps<"/inventory/[id]">) {
  await requireAdmin();
  const { id } = await params;
  const { error } = await searchParams;
  const supabase = await createClient();

  const [{ data: item }, { data: cats }, { data: holders }, { data: moves }] = await Promise.all([
    supabase.from("items").select("*").eq("id", id).maybeSingle<Item>(),
    supabase.from("items").select("category"),
    supabase
      .from("request_items")
      .select("qty, requests!inner(id, due_date, status, profiles!requests_student_id_fkey(full_name, student_id))")
      .eq("item_id", id)
      .eq("requests.status", "approved")
      .returns<Holder[]>(),
    supabase
      .from("stock_movements")
      .select("id, delta, reason, created_at")
      .eq("item_id", id)
      .order("created_at", { ascending: false })
      .limit(15),
  ]);
  if (!item) notFound();

  const categories = [...new Set((cats ?? []).map((r) => r.category as string))].sort();
  const qrSvg = await QRCode.toString(`${env.appUrl()}/inventory/${item.id}`, {
    type: "svg",
    margin: 0,
    color: { dark: "#1d45d8", light: "#ffffff" },
  });
  const t = today();

  return (
    <>
      <div className="no-print">
      <PageHeader title={item.name} description={<>{item.category}{item.sku && <> · <span className="font-mono">{item.sku}</span></>}</>} />
      </div>
      {typeof error === "string" && (
        <div className="no-print mb-4">
          <Alert>{error}</Alert>
        </div>
      )}
      <div className="grid grid-cols-1 gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <Card className="no-print p-6">
          <ItemForm item={item} categories={categories} />
        </Card>

        <div className="flex flex-col gap-6">
          <Card className="no-print p-5">
            <h2 className="mb-3 font-semibold">Stock</h2>
            <StockMeter available={item.available_qty} total={item.total_qty} threshold={item.low_stock_threshold} />
            <p className="mt-2 text-sm text-muted">
              {item.total_qty - item.available_qty} borrowed · alert at {item.low_stock_threshold}
            </p>
          </Card>

          <Card className="p-5 print:border-0 print:shadow-none">
            <h2 className="no-print mb-3 font-semibold">QR label</h2>
            <div className="mx-auto w-48 rounded-xl border border-line p-4 text-center">
              <div className="mx-auto size-36" dangerouslySetInnerHTML={{ __html: qrSvg }} />
              <p className="mt-2 truncate text-sm font-semibold">{item.name}</p>
              {item.sku && <p className="font-mono text-xs text-muted">{item.sku}</p>}
            </div>
            <PrintButton className="no-print mt-3 w-full" label="Print label" />
          </Card>

          <Card className="no-print p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <Users className="size-4 text-brand-600" aria-hidden /> Who has it now
            </h2>
            {!holders?.length ? (
              <p className="text-sm text-muted">Nobody — all units are in the studio.</p>
            ) : (
              <ul className="flex flex-col gap-2 text-sm">
                {holders.map((h) => (
                  <li key={h.requests!.id} className="flex items-center justify-between gap-2">
                    <Link href={`/requests/${h.requests!.id}`} className="font-medium text-brand-700 hover:underline">
                      {h.requests!.profiles?.full_name} × {h.qty}
                    </Link>
                    <Badge tone={h.requests!.due_date < t ? "red" : "blue"}>{dueLabel(h.requests!.due_date, t)}</Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card className="no-print p-5">
            <h2 className="mb-3 flex items-center gap-2 font-semibold">
              <History className="size-4 text-brand-600" aria-hidden /> Recent stock changes
            </h2>
            {!moves?.length ? (
              <p className="text-sm text-muted">No changes recorded.</p>
            ) : (
              <ul className="flex flex-col gap-1.5 text-sm">
                {moves.map((m) => (
                  <li key={m.id} className="flex justify-between gap-2">
                    <span className="text-muted">
                      {formatDate(m.created_at)} · {m.reason}
                    </span>
                    <span className={m.delta > 0 ? "font-semibold text-ok" : m.delta < 0 ? "font-semibold text-bad" : "text-muted"}>
                      {m.delta > 0 ? `+${m.delta}` : m.delta}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <form action={deleteItem} className="no-print">
            <input type="hidden" name="id" value={item.id} />
            <Button variant="danger" type="submit" className="w-full">
              <Trash2 className="size-4" aria-hidden /> Delete item
            </Button>
          </form>
        </div>
      </div>
    </>
  );
}
