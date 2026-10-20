import type { Metadata } from "next";
import { Bell } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Card, EmptyState, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { markAllRead } from "./actions";
import { NotificationList, type NotificationView } from "./notification-list";

export const metadata: Metadata = { title: "Notifications" };

const TZ = process.env.APP_TIMEZONE ?? "Africa/Addis_Ababa";

function ago(iso: string, now: number) {
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d} days ago`;
}


type Row = { id: string; kind: string; title: string; body: string | null; link: string | null; details: unknown; read: boolean; created_at: string };

/** Server-side formatting (relative times are computed here, not in the browser). */
function toViews(rows: Row[]): NotificationView[] {
  const now = Date.now();
  return rows.map((n) => ({
    id: n.id,
    kind: n.kind,
    title: n.title,
    body: n.body ?? "",
    link: n.link,
    details: Array.isArray(n.details) ? (n.details as [string, string][]) : null,
    read: n.read,
    ago: ago(n.created_at, now),
    when: new Date(n.created_at).toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: TZ }),
  }));
}

export default async function NotificationsPage() {
  const me = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("id, kind, title, body, link, details, read, created_at")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const list = toViews(data ?? []);
  const unread = list.filter((n) => !n.read).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread · tap one to open it` : "You're all caught up."}
        actions={
          unread > 0 && (
            <form action={markAllRead}>
              <SubmitButton variant="secondary">Mark all as read</SubmitButton>
            </form>
          )
        }
      />
      <Card className="overflow-hidden">
        {list.length === 0 ? (
          <EmptyState icon={<Bell className="size-6" />} title="No notifications yet">
            Reminders about due dates, approvals and stock will show up here and in your email.
          </EmptyState>
        ) : (
          <NotificationList items={list} />
        )}
      </Card>
    </>
  );
}
