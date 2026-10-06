import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminRecipients, notify, type Recipient } from "@/lib/notify";
import { addDays, daysBetween, dueLabel, formatDate, nextCheckin, today } from "@/lib/dates";
import type { Settings } from "@/lib/types";

interface DueRow {
  id: string;
  project: string;
  due_date: string;
  profiles: Recipient & { student_id: string };
  request_items: { qty: number; items: { name: string } | null }[];
}

/** Monday of the week containing `date` — used to send at most one digest per week. */
function weekKey(date: string) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((day + 6) % 7));
}

function itemList(row: DueRow) {
  return row.request_items.map((l) => `${l.qty} × ${l.items?.name ?? "item"}`).join(", ");
}

/**
 * Daily job (Vercel Cron → /api/cron/alerts). Safe to run more than once a day:
 * every notice carries a dedupe key.
 */
export async function runAlerts() {
  const db = createAdminClient();
  const t = today();
  const { data: settings } = await db.from("settings").select("*").single<Settings>();
  if (!settings) throw new Error("settings row missing");
  const admins = await adminRecipients();
  const sent = { dueSoon: 0, overdue: 0, adminDigest: 0, checkin: 0, lowStock: 0 };

  // 1. Borrowers: return date near / overdue.
  const { data: due } = await db
    .from("requests")
    .select(
      "id, project, due_date, profiles!requests_student_id_fkey(id, email, full_name, student_id), request_items(qty, items(name))",
    )
    .eq("status", "approved")
    .lte("due_date", addDays(t, settings.due_soon_days))
    .order("due_date")
    .returns<DueRow[]>();

  for (const row of due ?? []) {
    const n = daysBetween(t, row.due_date);
    const link = `/requests/${row.id}`;
    if (n >= 0) {
      sent.dueSoon += await notify([row.profiles], {
        kind: "due_soon",
        title: `Return reminder: ${dueLabel(row.due_date, t)}`,
        body: `Please return ${itemList(row)} (project "${row.project}") by ${formatDate(row.due_date)}.`,
        link,
        dedupeKey: `due-soon:${row.id}`,
      });
    } else {
      // Remind on the first overdue day, then once a week.
      sent.overdue += await notify([row.profiles], {
        kind: "overdue",
        title: `Overdue: please return your items`,
        body: `${itemList(row)} for project "${row.project}" was due ${formatDate(row.due_date)} (${dueLabel(row.due_date, t)}).`,
        link,
        dedupeKey: `overdue:${row.id}:${Math.floor((-n - 1) / 7)}`,
      });
    }
  }

  // 2. Admins: one daily digest of near-due and overdue borrowers.
  if (due && due.length > 0) {
    const lines = due.map(
      (r) =>
        `• ${r.profiles.full_name} (${r.profiles.student_id}) — ${itemList(r)} — ${dueLabel(r.due_date, t)}`,
    );
    sent.adminDigest += await notify(admins, {
      kind: "admin_due",
      title: `${due.length} borrowed request${due.length === 1 ? "" : "s"} due soon or overdue`,
      body: lines.join("\n"),
      link: "/requests?filter=due",
      dedupeKey: `admin-due:${t}`,
    });
  }

  // 3. Admins: monthly check-in coming up.
  const checkin = nextCheckin(settings.checkin_day, t);
  const untilCheckin = daysBetween(t, checkin);
  if (untilCheckin <= settings.checkin_notice_days) {
    sent.checkin += await notify(admins, {
      kind: "checkin",
      title:
        untilCheckin === 0
          ? "Monthly check-in is today"
          : `Monthly check-in in ${untilCheckin} day${untilCheckin === 1 ? "" : "s"}`,
      body: `The monthly inventory check-in is on ${formatDate(checkin)}. The check-in page lists what is out, overdue and left in stock.`,
      link: "/checkin",
      dedupeKey: untilCheckin === 0 ? `checkin-day:${checkin}` : `checkin:${checkin}`,
    });
  }

  // 4. Admins: weekly "items to reorder" digest.
  const { data: items } = await db
    .from("items")
    .select("name, available_qty, total_qty, low_stock_threshold");
  const low = (items ?? []).filter((i) => i.available_qty <= i.low_stock_threshold);
  if (low.length > 0) {
    sent.lowStock += await notify(admins, {
      kind: "low_stock",
      title: `${low.length} item${low.length === 1 ? " is" : "s are"} low — consider ordering more`,
      body: low
        .map((i) => `• ${i.name}: ${i.available_qty} available of ${i.total_qty} (alert at ${i.low_stock_threshold})`)
        .join("\n"),
      link: "/inventory?filter=low",
      dedupeKey: `low-stock:${weekKey(t)}`,
    });
  }

  return { date: t, sent };
}
