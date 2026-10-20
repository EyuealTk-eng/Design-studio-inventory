import type { Metadata } from "next";
import { Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatPhone } from "@/lib/phone";
import { Alert, Card, EmptyState, PageHeader } from "@/components/ui";
import { MemberList, type MemberView } from "./member-list";

export const metadata: Metadata = { title: "Members" };

const TZ = process.env.APP_TIMEZONE ?? "Africa/Addis_Ababa";
const ONLINE_MS = 5 * 60_000;

type Row = {
  id: string; full_name: string; student_id: string; email: string; phone: string | null; department: string; year: number;
  role: "student" | "admin"; created_at: string; last_seen_at: string | null; last_sign_in_at: string | null;
  items_out: number; overdue: number; pending: number; total_requests: number;
};

const dayKey = (iso: string) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date(iso));

function seenLabel(iso: string | null, now: number): string {
  if (!iso) return "Not since this feature was added";
  const s = Math.max(0, Math.round((now - Date.parse(iso)) / 1000));
  if (s < 60) return "Active just now";
  const m = Math.round(s / 60);
  if (m < 60) return `Active ${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `Active ${h} h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "Active yesterday" : `Active ${d} days ago`;
}

const stamp = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: TZ }) : "—";

/** Formatting happens here on the server; the browser only filters. */
function toViews(rows: Row[]): MemberView[] {
  const now = Date.now();
  const todayKey = dayKey(new Date(now).toISOString());
  return rows.map((r) => ({
    id: r.id,
    name: r.full_name,
    studentId: r.student_id,
    email: r.email,
    phone: r.phone ? formatPhone(r.phone) : null,
    phoneRaw: r.phone,
    department: r.department,
    year: r.year,
    admin: r.role === "admin",
    online: !!r.last_seen_at && now - Date.parse(r.last_seen_at) < ONLINE_MS,
    today: !!r.last_seen_at && dayKey(r.last_seen_at) === todayKey,
    seen: seenLabel(r.last_seen_at, now),
    seenAt: stamp(r.last_seen_at),
    signedIn: stamp(r.last_sign_in_at),
    joined: new Date(r.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric", timeZone: TZ }),
    itemsOut: Number(r.items_out),
    overdue: Number(r.overdue),
    pending: Number(r.pending),
    totalRequests: Number(r.total_requests),
  }));
}

export default async function MembersPage() {
  const me = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("members_overview");
  const members = toViews((data as Row[] | null) ?? []);
  const online = members.filter((m) => m.online).length;

  return (
    <>
      <PageHeader
        title="Members"
        description={
          error
            ? "Everyone with access to the studio."
            : `${members.length} members · ${online} online now · updates every 30 seconds`
        }
      />
      {error ? (
        <Alert>
          The Members page needs one more database update. In Supabase, open SQL Editor, paste the file{" "}
          <span className="font-mono">supabase/migrations/0005_members_presence.sql</span> and press Run.
        </Alert>
      ) : members.length === 0 ? (
        <Card>
          <EmptyState icon={<Users className="size-6" />} title="No members yet">
            Approved students and admins will appear here.
          </EmptyState>
        </Card>
      ) : (
        <MemberList members={members} meId={me.id} />
      )}
    </>
  );
}
