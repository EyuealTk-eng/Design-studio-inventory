import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { CalendarCheck, Download } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { loadCheckin } from "@/lib/checkin";
import { dueLabel, formatDate, nextCheckin, today } from "@/lib/dates";
import { isLowStock } from "@/lib/types";
import { Alert, Badge, Card, PageHeader, buttonClass, cx } from "@/components/ui";
import { PrintButton } from "@/components/print-button";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "Monthly check-in" };

async function completeCheckin() {
  "use server";
  await requireAdmin();
  const supabase = await createClient();
  await supabase.from("settings").update({ last_checkin_at: today() }).eq("id", 1);
  revalidatePath("/checkin");
  revalidatePath("/dashboard");
}

export default async function CheckinPage() {
  await requireAdmin();
  const supabase = await createClient();
  const data = await loadCheckin(supabase);
  const { items, out, activity, since, settings } = data;
  const t = data.today;
  const unitsOut = out.reduce((s, r) => s + r.qty, 0);
  const overdue = out.filter((r) => r.dueDate < t);
  const low = items.filter(isLowStock);
  const doneToday = settings?.last_checkin_at === t;

  const stats = [
    { label: "Items in catalogue", value: items.length },
    { label: "Units borrowed now", value: unitsOut },
    { label: "Overdue lines", value: overdue.length, bad: overdue.length > 0 },
    { label: "Low stock", value: low.length, bad: low.length > 0 },
  ];

  return (
    <>
      <PageHeader
        title="Monthly check-in"
        description={<>Activity since {formatDate(since)} · next check-in {formatDate(nextCheckin(settings?.checkin_day ?? 28))}</>}
        actions={
          <>
            <PrintButton label="Print count sheet" />
            {/* File download from a route handler, not a page navigation. */}
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/api/export/checkin" className={buttonClass("secondary")}>
              <Download className="size-4" aria-hidden /> Export Excel
            </a>
          </>
        }
      />

      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map((s) => (
          <Card key={s.label} className="p-4">
            <p className="text-sm text-muted">{s.label}</p>
            <p className={cx("mt-1 text-3xl font-bold tabular-nums", s.bad ? "text-bad" : "text-ink")}>{s.value}</p>
          </Card>
        ))}
      </div>

      <div className="flex flex-col gap-6">
        <Card className="overflow-hidden">
          <h2 className="border-b border-line px-5 py-4 font-semibold">Currently borrowed</h2>
          {out.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">Nothing is out — every item is in the studio.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-surface text-xs font-semibold uppercase tracking-wide text-muted">
                  <tr>
                    {["Student", "Item", "Qty", "Project", "Due"].map((h) => (
                      <th key={h} scope="col" className="px-5 py-2.5">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {out.map((r, i) => (
                    <tr key={i}>
                      <td className="px-5 py-2.5">
                        <Link href={`/requests/${r.requestId}`} className="font-medium text-brand-700 hover:underline">{r.student}</Link>
                        <span className="block text-xs text-muted">{r.studentId}</span>
                      </td>
                      <td className="px-5 py-2.5">{r.item}</td>
                      <td className="px-5 py-2.5 tabular-nums">{r.qty}</td>
                      <td className="px-5 py-2.5 text-muted">{r.project}</td>
                      <td className="px-5 py-2.5">
                        <Badge tone={r.dueDate < t ? "red" : "blue"}>{dueLabel(r.dueDate, t)}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="overflow-hidden">
          <h2 className="border-b border-line px-5 py-4 font-semibold">Stock count sheet</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-xs font-semibold uppercase tracking-wide text-muted">
                <tr>
                  {["Item", "Location", "Total", "Out", "Should be on shelf", "Counted", "Moved since last check-in"].map((h) => (
                    <th key={h} scope="col" className="px-4 py-2.5">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {items.map((i) => {
                  const a = activity.find((x) => x.itemId === i.id);
                  return (
                    <tr key={i.id}>
                      <td className="px-4 py-2.5">
                        <span className="font-medium">{i.name}</span>
                        {isLowStock(i) && <span className="ml-2 align-middle"><Badge tone="amber">Low</Badge></span>}
                        <span className="block text-xs text-muted">{i.category}</span>
                      </td>
                      <td className="px-4 py-2.5 text-muted">{i.location ?? "—"}</td>
                      <td className="px-4 py-2.5 tabular-nums">{i.total_qty}</td>
                      <td className="px-4 py-2.5 tabular-nums">{i.total_qty - i.available_qty}</td>
                      <td className="px-4 py-2.5 font-semibold tabular-nums">{i.available_qty}</td>
                      <td className="px-4 py-2.5"><span className="inline-block h-6 w-16 border-b border-slate-400" aria-hidden /></td>
                      <td className="px-4 py-2.5 text-xs text-muted">
                        {a ? [a.borrowed && `${a.borrowed} out`, a.returned && `${a.returned} back`, a.lost && `${a.lost} lost`, a.adjusted > 0 && `+${a.adjusted} added`, a.adjusted < 0 && `${-a.adjusted} removed`].filter(Boolean).join(" · ") || "—" : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        <Card className="no-print flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <CalendarCheck className="size-6 text-brand-600" aria-hidden />
            <div>
              <p className="font-semibold">Finished counting?</p>
              <p className="text-sm text-muted">
                Last completed: {formatDate(settings?.last_checkin_at)}. Fix any differences on the item pages, then mark this month done.
              </p>
            </div>
          </div>
          {doneToday ? (
            <Alert tone="green">Check-in completed today.</Alert>
          ) : (
            <form action={completeCheckin}>
              <SubmitButton pendingText="Saving…">Mark check-in complete</SubmitButton>
            </form>
          )}
        </Card>
      </div>
    </>
  );
}
