import type { Metadata } from "next";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Boxes,
  CalendarCheck,
  ClipboardList,
  PackageOpen,
  PackagePlus,
  ShoppingCart,
} from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { addDays, daysBetween, dueLabel, formatDate, nextCheckin, today } from "@/lib/dates";
import { isLowStock, type BorrowRequest, type Item, type Profile, type Settings } from "@/lib/types";
import { Badge, ButtonLink, Card, StatusBadge, cx } from "@/components/ui";
import { StatCard } from "@/components/stat-card";

export const metadata: Metadata = { title: "Dashboard" };

const REQUEST_SELECT =
  "*, profiles!requests_student_id_fkey(full_name, student_id, email, department, year), request_items(item_id, qty, lost_qty, items(id, name, category, available_qty))";

function greeting() {
  const h = Number(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: process.env.APP_TIMEZONE ?? "Africa/Addis_Ababa" }).format(new Date()));
  return h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function DashboardPage() {
  const profile = await requireUser();
  return profile.role === "admin" ? <AdminDashboard profile={profile} /> : <StudentDashboard profile={profile} />;
}

function Hero({ profile, children }: { profile: Profile; children?: React.ReactNode }) {
  return (
    <div className="relative mb-8 overflow-hidden rounded-3xl bg-brand-700 px-6 py-8 text-white sm:px-8">
      <div className="bg-grid absolute inset-0 opacity-25" aria-hidden />
      <div className="absolute -right-16 -top-20 size-72 rounded-full bg-brand-400/40 blur-3xl" aria-hidden />
      <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-brand-100">{formatDate(today())}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
            {greeting()}, {profile.full_name.split(" ")[0]}
          </h1>
        </div>
        {children}
      </div>
    </div>
  );
}

function Panel({ title, href, linkLabel, children }: { title: string; href?: string; linkLabel?: string; children: React.ReactNode }) {
  return (
    <Card className="flex flex-col overflow-hidden">
      <div className="flex items-center justify-between border-b border-line px-5 py-4">
        <h2 className="font-semibold">{title}</h2>
        {href && (
          <Link href={href} className="inline-flex items-center gap-1 text-sm font-semibold text-brand-700 hover:underline">
            {linkLabel ?? "View all"} <ArrowRight className="size-4" aria-hidden />
          </Link>
        )}
      </div>
      <div className="flex-1">{children}</div>
    </Card>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="px-5 py-8 text-center text-sm text-muted">{children}</p>;
}

async function AdminDashboard({ profile }: { profile: Profile }) {
  const supabase = await createClient();
  const t = today();
  const [{ data: items }, { data: active }, { data: pending }, { data: settings }, { count: waitingUsers }] = await Promise.all([
    supabase.from("items").select("*").returns<Item[]>(),
    supabase.from("requests").select(REQUEST_SELECT).eq("status", "approved").order("due_date").returns<BorrowRequest[]>(),
    supabase.from("requests").select(REQUEST_SELECT).eq("status", "pending").order("created_at").returns<BorrowRequest[]>(),
    supabase.from("settings").select("*").single<Settings>(),
    supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending"),
  ]);
  const all = items ?? [];
  const low = all.filter(isLowStock).sort((a, b) => a.available_qty / (a.total_qty || 1) - b.available_qty / (b.total_qty || 1));
  const borrowed = active ?? [];
  const overdue = borrowed.filter((r) => r.due_date < t);
  const dueSoon = borrowed.filter((r) => r.due_date <= addDays(t, settings?.due_soon_days ?? 3));
  const unitsOut = all.reduce((s, i) => s + (i.total_qty - i.available_qty), 0);
  const unitsTotal = all.reduce((s, i) => s + i.total_qty, 0);
  const checkin = nextCheckin(settings?.checkin_day ?? 28, t);
  const untilCheckin = daysBetween(t, checkin);

  // Stock health by category (share of units currently on the shelf).
  const byCat = new Map<string, { total: number; avail: number }>();
  for (const i of all) {
    const c = byCat.get(i.category) ?? { total: 0, avail: 0 };
    c.total += i.total_qty;
    c.avail += i.available_qty;
    byCat.set(i.category, c);
  }
  const categories = [...byCat.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, 8);

  return (
    <>
      <Hero profile={profile}>
        <Link
          href="/checkin"
          className="inline-flex items-center gap-3 rounded-2xl bg-white/10 px-4 py-3 ring-1 ring-white/20 transition-colors hover:bg-white/15"
        >
          <CalendarCheck className="size-6" aria-hidden />
          <span>
            <span className="block text-xs text-brand-100">Monthly check-in</span>
            <span className="font-semibold">
              {untilCheckin === 0 ? "Today" : `In ${untilCheckin} day${untilCheckin === 1 ? "" : "s"}`} · {formatDate(checkin)}
            </span>
          </span>
        </Link>
      </Hero>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard index={0} label="Pending requests" value={pending?.length ?? 0} hint={waitingUsers ? `${waitingUsers} registration${waitingUsers === 1 ? "" : "s"} waiting too` : "Waiting for approval"} icon={<ClipboardList aria-hidden />} tone="amber" href="/requests?filter=pending" />
        <StatCard index={1} label="Units borrowed" value={unitsOut} hint={`of ${unitsTotal} units in total`} icon={<PackageOpen aria-hidden />} href="/inventory?filter=out" />
        <StatCard index={2} label="Overdue" value={overdue.length} hint={overdue.length ? "Reminders are sent automatically" : "Everything on time"} icon={<AlertTriangle aria-hidden />} tone={overdue.length ? "red" : "green"} href="/requests?filter=due" />
        <StatCard index={3} label="To reorder" value={low.length} hint="Items at or below low-stock level" icon={<ShoppingCart aria-hidden />} tone={low.length ? "amber" : "green"} href="/inventory?filter=low" />
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel title="Waiting for approval" href="/requests?filter=pending">
          {!pending?.length ? (
            <Empty>No pending requests.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {pending.slice(0, 5).map((r) => (
                <li key={r.id}>
                  <Link href={`/requests/${r.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/40">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.profiles?.full_name} · {r.project}</p>
                      <p className="truncate text-xs text-muted">{r.request_items?.map((l) => `${l.qty} × ${l.items?.name}`).join(", ")}</p>
                    </div>
                    <span className="text-xs text-muted">{formatDate(r.created_at)}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Due soon & overdue" href="/requests?filter=due">
          {dueSoon.length === 0 ? (
            <Empty>No returns due in the next {settings?.due_soon_days ?? 3} days.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {dueSoon.slice(0, 6).map((r) => (
                <li key={r.id}>
                  <Link href={`/requests/${r.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/40">
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-medium">{r.profiles?.full_name}</p>
                      <p className="truncate text-xs text-muted">{r.request_items?.map((l) => `${l.qty} × ${l.items?.name}`).join(", ")}</p>
                    </div>
                    <Badge tone={r.due_date < t ? "red" : "amber"}>{dueLabel(r.due_date, t)}</Badge>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Items to reorder" href="/inventory?filter=low">
          {low.length === 0 ? (
            <Empty>All items are above their low-stock level.</Empty>
          ) : (
            <ul className="divide-y divide-line">
              {low.slice(0, 6).map((i) => (
                <li key={i.id}>
                  <Link href={`/inventory/${i.id}`} className="flex items-center gap-3 px-5 py-3 hover:bg-brand-50/40">
                    <span className="min-w-0 flex-1 truncate font-medium">{i.name}</span>
                    <span className="text-sm tabular-nums text-muted">
                      <b className={i.available_qty === 0 ? "text-bad" : "text-warn"}>{i.available_qty}</b> left · alert at {i.low_stock_threshold}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Stock on the shelf by category" href="/inventory" linkLabel="Inventory">
          {categories.length === 0 ? (
            <Empty>Add or import items to see stock health.</Empty>
          ) : (
            <ul className="flex flex-col gap-3 px-5 py-4">
              {categories.map(([name, c]) => {
                const pct = c.total ? Math.round((c.avail / c.total) * 100) : 0;
                return (
                  <li key={name}>
                    <div className="mb-1 flex justify-between text-sm">
                      <span className="font-medium">{name}</span>
                      <span className="tabular-nums text-muted">
                        {c.avail}/{c.total} · {pct}%
                      </span>
                    </div>
                    <div className="h-2.5 overflow-hidden rounded-full bg-brand-50" role="img" aria-label={`${name}: ${pct}% on the shelf`}>
                      <div className={cx("h-full rounded-full", pct < 25 ? "bg-warn" : "bg-brand-500")} style={{ width: `${pct}%` }} />
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </Panel>
      </div>
    </>
  );
}

async function StudentDashboard({ profile }: { profile: Profile }) {
  const supabase = await createClient();
  const t = today();
  const [{ data: mine }, { count: itemCount }] = await Promise.all([
    supabase.from("requests").select(REQUEST_SELECT).eq("student_id", profile.id).in("status", ["pending", "approved"]).order("due_date").returns<BorrowRequest[]>(),
    supabase.from("items").select("id", { count: "exact", head: true }).gt("available_qty", 0),
  ]);
  const active = (mine ?? []).filter((r) => r.status === "approved");
  const pending = (mine ?? []).filter((r) => r.status === "pending");
  const overdue = active.filter((r) => r.due_date < t);

  return (
    <>
      <Hero profile={profile}>
        <ButtonLink href="/requests/new" variant="secondary" className="border-transparent">
          <PackagePlus className="size-4" aria-hidden /> Borrow items
        </ButtonLink>
      </Hero>

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard index={0} label="Borrowed by you" value={active.reduce((s, r) => s + (r.request_items ?? []).reduce((a, l) => a + l.qty, 0), 0)} hint={`${active.length} active request${active.length === 1 ? "" : "s"}`} icon={<PackageOpen aria-hidden />} />
        <StatCard index={1} label="Waiting for approval" value={pending.length} icon={<ClipboardList aria-hidden />} tone="amber" href="/requests" />
        <StatCard index={2} label="Items available" value={itemCount ?? 0} hint="Ready to borrow" icon={<Boxes aria-hidden />} tone="green" href="/inventory" />
      </div>

      {overdue.length > 0 && (
        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-bad/20 bg-bad-bg px-4 py-3 text-sm font-medium text-bad" role="alert">
          <AlertTriangle className="size-5 shrink-0" aria-hidden />
          You have {overdue.length} overdue request{overdue.length === 1 ? "" : "s"}. Please return the items to the studio as soon as possible.
        </div>
      )}

      <Panel title="Your borrowed & pending items" href="/requests">
        {!mine?.length ? (
          <Empty>
            Nothing borrowed right now.{" "}
            <Link href="/requests/new" className="font-semibold text-brand-700 hover:underline">Borrow items</Link>
          </Empty>
        ) : (
          <ul className="divide-y divide-line">
            {mine.map((r) => {
              const late = r.status === "approved" && r.due_date < t;
              return (
                <li key={r.id}>
                  <Link href={`/requests/${r.id}`} className="flex flex-col gap-1 px-5 py-4 hover:bg-brand-50/40 sm:flex-row sm:items-center sm:gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{r.project}</p>
                        <StatusBadge status={r.status} overdue={late} />
                      </div>
                      <p className="truncate text-sm text-muted">{r.request_items?.map((l) => `${l.qty} × ${l.items?.name}`).join(", ")}</p>
                    </div>
                    <p className={cx("text-sm font-semibold", late ? "text-bad" : "text-ink")}>
                      {r.status === "approved" ? `Return ${dueLabel(r.due_date, t)}` : `Return by ${formatDate(r.due_date)}`}
                    </p>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </Panel>
    </>
  );
}
