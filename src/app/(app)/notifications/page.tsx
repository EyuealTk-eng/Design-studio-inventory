import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { AlertTriangle, Bell, BellRing, CalendarCheck, CheckCircle2, ClipboardList, PackageX, UserPlus, type LucideIcon } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate } from "@/lib/dates";
import { Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "Notifications" };

const ICONS: Record<string, LucideIcon> = {
  due_soon: BellRing,
  overdue: AlertTriangle,
  admin_due: BellRing,
  checkin: CalendarCheck,
  low_stock: PackageX,
  signup: UserPlus,
  new_request: ClipboardList,
  request_approved: CheckCircle2,
  returned: CheckCircle2,
};

async function markAllRead() {
  "use server";
  const me = await requireUser();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("user_id", me.id).eq("read", false);
  revalidatePath("/", "layout");
}

export default async function NotificationsPage() {
  const me = await requireUser();
  const supabase = await createClient();
  const { data } = await supabase
    .from("notifications")
    .select("*")
    .eq("user_id", me.id)
    .order("created_at", { ascending: false })
    .limit(100);
  const list = data ?? [];
  const unread = list.filter((n) => !n.read).length;

  return (
    <>
      <PageHeader
        title="Notifications"
        description={unread ? `${unread} unread` : "You're all caught up."}
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
          <ul className="divide-y divide-line">
            {list.map((n) => {
              const Icon = ICONS[n.kind] ?? Bell;
              const urgent = n.kind === "overdue" || n.kind === "low_stock";
              const body = (
                <div className="flex gap-4 px-5 py-4">
                  <span className={cx("grid size-10 shrink-0 place-items-center rounded-xl", urgent ? "bg-bad-bg text-bad" : "bg-brand-50 text-brand-600")}>
                    <Icon className="size-5" aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className={cx("text-ink", n.read ? "font-medium" : "font-bold")}>
                      {!n.read && <span className="mr-2 inline-block size-2 rounded-full bg-brand-600 align-middle" aria-label="Unread" />}
                      {n.title}
                    </p>
                    {n.body && <p className="mt-0.5 whitespace-pre-line text-sm text-muted">{n.body}</p>}
                    <p className="mt-1 text-xs text-muted">{formatDate(n.created_at)}</p>
                  </div>
                </div>
              );
              return (
                <li key={n.id} className={cx(!n.read && "bg-brand-50/40")}>
                  {n.link ? (
                    <Link href={n.link} className="block transition-colors hover:bg-brand-50/60">{body}</Link>
                  ) : (
                    body
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </>
  );
}
