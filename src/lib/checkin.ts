import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { addDays, today } from "@/lib/dates";
import type { Item, Settings } from "@/lib/types";

export interface OutRow {
  requestId: string;
  student: string;
  studentId: string;
  project: string;
  item: string;
  qty: number;
  dueDate: string;
}

export interface ActivityRow {
  itemId: string;
  name: string;
  borrowed: number;
  returned: number;
  lost: number;
  adjusted: number;
}

/** Everything the monthly check-in needs, since the last completed check-in (or 31 days). */
export async function loadCheckin(supabase: SupabaseClient) {
  const t = today();
  const { data: settings } = await supabase.from("settings").select("*").single<Settings>();
  const since = settings?.last_checkin_at ?? addDays(t, -31);

  const [{ data: items }, { data: out }, { data: moves }] = await Promise.all([
    supabase.from("items").select("*").order("category").order("name").returns<Item[]>(),
    supabase
      .from("request_items")
      .select("qty, items(name), requests!inner(id, project, due_date, status, profiles!requests_student_id_fkey(full_name, student_id))")
      .eq("requests.status", "approved")
      .returns<
        {
          qty: number;
          items: { name: string } | null;
          requests: { id: string; project: string; due_date: string; profiles: { full_name: string; student_id: string } | null };
        }[]
      >(),
    supabase
      .from("stock_movements")
      .select("item_id, delta, reason")
      .gte("created_at", `${since}T00:00:00Z`)
      .returns<{ item_id: string; delta: number; reason: string }[]>(),
  ]);

  const outRows: OutRow[] = (out ?? [])
    .map((r) => ({
      requestId: r.requests.id,
      student: r.requests.profiles?.full_name ?? "—",
      studentId: r.requests.profiles?.student_id ?? "",
      project: r.requests.project,
      item: r.items?.name ?? "—",
      qty: r.qty,
      dueDate: r.requests.due_date,
    }))
    .sort((a, b) => a.dueDate.localeCompare(b.dueDate));

  const names = new Map((items ?? []).map((i) => [i.id, i.name]));
  const activity = new Map<string, ActivityRow>();
  for (const m of moves ?? []) {
    const row =
      activity.get(m.item_id) ??
      { itemId: m.item_id, name: names.get(m.item_id) ?? "Deleted item", borrowed: 0, returned: 0, lost: 0, adjusted: 0 };
    if (m.reason === "borrowed") row.borrowed += -m.delta;
    else if (m.reason === "returned") row.returned += m.delta;
    else if (m.reason.startsWith("lost")) row.lost += Number(m.reason.split(":")[1]) || 0;
    else row.adjusted += m.delta;
    activity.set(m.item_id, row);
  }

  return {
    today: t,
    since,
    settings,
    items: items ?? [],
    out: outRows,
    activity: [...activity.values()].sort((a, b) => a.name.localeCompare(b.name)),
  };
}
