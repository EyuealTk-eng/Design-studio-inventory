import { getCurrentProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { buildWorkbook } from "@/lib/excel";
import { loadCheckin } from "@/lib/checkin";
import { today } from "@/lib/dates";
import type { Item } from "@/lib/types";

const XLSX = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

function itemRows(items: Item[]) {
  return items.map((i) => ({
    Name: i.name,
    Category: i.category,
    Code: i.sku,
    Location: i.location,
    Condition: i.condition,
    Quantity: i.total_qty,
    Available: i.available_qty,
    Borrowed: i.total_qty - i.available_qty,
    "Low stock": i.low_stock_threshold,
    Notes: i.notes,
  }));
}

export async function GET(_req: Request, ctx: RouteContext<"/api/export/[kind]">) {
  const { kind } = await ctx.params;
  if (kind === "template") {
    const buf = await buildWorkbook([
      {
        name: "Inventory",
        rows: [
          { Name: "Arduino Uno R3", Category: "Electronics", Code: "EL-001", Location: "Cabinet A", Condition: "Good", Quantity: 10, "Low stock": 3, Notes: "" },
          { Name: "Digital multimeter", Category: "Test equipment", Code: "TE-004", Location: "Bench 2", Condition: "Good", Quantity: 4, "Low stock": 1, Notes: "" },
        ],
      },
    ]);
    return file(buf, "inventory-template.xlsx");
  }

  const profile = await getCurrentProfile();
  if (profile?.role !== "admin") return new Response("Forbidden", { status: 403 });
  const supabase = await createClient();

  if (kind === "inventory") {
    const { data } = await supabase.from("items").select("*").order("category").order("name");
    const buf = await buildWorkbook([{ name: "Inventory", rows: itemRows((data ?? []) as Item[]) }]);
    return file(buf, `inventory-${today()}.xlsx`);
  }

  if (kind === "checkin") {
    const c = await loadCheckin(supabase);
    const buf = await buildWorkbook([
      { name: "Stock", rows: itemRows(c.items).map((r) => ({ ...r, Counted: null })) },
      {
        name: "Borrowed now",
        rows: c.out.map((r) => ({
          Student: r.student,
          "Student ID": r.studentId,
          Item: r.item,
          Qty: r.qty,
          Project: r.project,
          "Due date": r.dueDate,
          Overdue: r.dueDate < c.today ? "YES" : "",
        })),
      },
      {
        name: `Activity since ${c.since}`.slice(0, 31),
        rows: c.activity.map((a) => ({
          Item: a.name,
          Borrowed: a.borrowed,
          Returned: a.returned,
          "Lost/broken": a.lost,
          Adjusted: a.adjusted,
        })),
      },
    ]);
    return file(buf, `monthly-checkin-${c.today}.xlsx`);
  }

  return new Response("Not found", { status: 404 });
}

function file(buf: ArrayBuffer, name: string) {
  return new Response(buf, {
    headers: {
      "Content-Type": XLSX,
      "Content-Disposition": `attachment; filename="${name}"`,
      "Cache-Control": "no-store",
    },
  });
}
