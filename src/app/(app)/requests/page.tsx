import type { Metadata } from "next";
import Link from "next/link";
import { ClipboardList, PackagePlus } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, dueLabel, formatDate, today } from "@/lib/dates";
import type { BorrowRequest } from "@/lib/types";
import { ButtonLink, Card, EmptyState, PageHeader, StatusBadge, cx } from "@/components/ui";

export const metadata: Metadata = { title: "Requests" };

const FILTERS = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Borrowed" },
  { key: "due", label: "Due soon & overdue" },
  { key: "returned", label: "Returned" },
  { key: "rejected", label: "Rejected" },
  { key: "all", label: "All" },
] as const;

export default async function RequestsPage({ searchParams }: PageProps<"/requests">) {
  const profile = await requireUser();
  const isAdmin = profile.role === "admin";
  const sp = await searchParams;
  const filter = typeof sp.filter === "string" ? sp.filter : isAdmin ? "pending" : "all";
  const t = today();

  const supabase = await createClient();
  const { data: settings } = await supabase.from("settings").select("due_soon_days").single();
  let query = supabase
    .from("requests")
    .select("*, profiles!requests_student_id_fkey(full_name, student_id, email, phone, department, year), request_items(item_id, qty, lost_qty, items(id, name, category, available_qty))")
    .order("created_at", { ascending: false });
  if (!isAdmin) query = query.eq("student_id", profile.id);
  if (filter === "due") {
    query = query.eq("status", "approved").lte("due_date", addDays(t, settings?.due_soon_days ?? 3)).order("due_date");
  } else if (filter !== "all") {
    query = query.eq("status", filter);
  }
  const { data } = await query.returns<BorrowRequest[]>();
  const requests = data ?? [];

  return (
    <>
      <PageHeader
        title={isAdmin ? "Borrow requests" : "My requests"}
        description={isAdmin ? "Approve requests, and check items back in when they're returned." : "Track your requests and return dates."}
        actions={
          !isAdmin && (
            <ButtonLink href="/requests/new">
              <PackagePlus className="size-4" aria-hidden /> Borrow items
            </ButtonLink>
          )
        }
      />

      <nav aria-label="Filter requests" className="no-print mb-4 flex gap-2 overflow-x-auto pb-1">
        {FILTERS.map((f) => (
          <Link
            key={f.key}
            href={`/requests?filter=${f.key}`}
            aria-current={filter === f.key ? "page" : undefined}
            className={cx(
              "inline-flex min-h-9 shrink-0 items-center rounded-full px-3.5 text-sm font-semibold ring-1 ring-inset transition-colors",
              filter === f.key ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-muted ring-line hover:text-ink",
            )}
          >
            {f.label}
          </Link>
        ))}
      </nav>

      <Card className="overflow-hidden">
        {requests.length === 0 ? (
          <EmptyState icon={<ClipboardList className="size-6" />} title="No requests here">
            {isAdmin ? "Nothing in this list right now." : "When you borrow items, your requests show up here."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {requests.map((r) => {
              const overdue = r.status === "approved" && r.due_date < t;
              const items = r.request_items ?? [];
              return (
                <li key={r.id}>
                  <Link href={`/requests/${r.id}`} className="flex flex-col gap-2 px-5 py-4 transition-colors hover:bg-brand-50/40 sm:flex-row sm:items-center sm:gap-6">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="font-semibold text-ink">{r.project}</p>
                        <StatusBadge status={r.status} overdue={overdue} />
                      </div>
                      <p className="mt-0.5 truncate text-sm text-muted">
                        {isAdmin && r.profiles && <>{r.profiles.full_name} ({r.profiles.student_id}) · </>}
                        {items.map((l) => `${l.qty} × ${l.items?.name}`).join(", ")}
                      </p>
                    </div>
                    <div className="shrink-0 text-sm sm:text-right">
                      <p className={cx("font-semibold", overdue ? "text-bad" : "text-ink")}>
                        {r.status === "approved" ? dueLabel(r.due_date, t) : r.status === "returned" ? `Returned ${formatDate(r.returned_at)}` : `Return by ${formatDate(r.due_date)}`}
                      </p>
                      <p className="text-xs text-muted">Requested {formatDate(r.created_at)}</p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
