"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin, requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { adminRecipients, notify } from "@/lib/notify";
import { formatDate, today } from "@/lib/dates";
import { createAdminClient } from "@/lib/supabase/admin";

export interface RequestFormState {
  error?: string;
  fieldErrors?: Record<string, string>;
}

const requestSchema = z.object({
  project: z.string().trim().min(2, "Name the project").max(200),
  purpose: z.string().trim().max(1000).default(""),
  due_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a return date"),
  lines: z
    .array(z.object({ item_id: z.string().uuid(), qty: z.number().int().min(1) }))
    .min(1, "Add at least one item"),
});

export async function createRequest(
  _prev: RequestFormState,
  formData: FormData,
): Promise<RequestFormState> {
  const profile = await requireUser();
  let lines: unknown;
  try {
    lines = JSON.parse(String(formData.get("lines") ?? "[]"));
  } catch {
    lines = [];
  }
  const parsed = requestSchema.safeParse({
    project: formData.get("project"),
    purpose: formData.get("purpose") ?? "",
    due_date: formData.get("due_date"),
    lines,
  });
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const i of parsed.error.issues) fieldErrors[String(i.path[0])] ??= i.message;
    return { fieldErrors };
  }
  const v = parsed.data;
  if (v.due_date < today()) return { fieldErrors: { due_date: "Return date can't be in the past" } };

  const letter = formData.get("letter");
  if (!(letter instanceof File) || letter.size === 0)
    return { fieldErrors: { letter: "Attach your request letter (PDF)" } };
  if (letter.type !== "application/pdf" && !letter.name.toLowerCase().endsWith(".pdf"))
    return { fieldErrors: { letter: "The letter must be a PDF" } };
  if (letter.size > 5 * 1024 * 1024) return { fieldErrors: { letter: "PDF must be 5 MB or smaller" } };

  const supabase = await createClient();
  const path = `${profile.id}/${crypto.randomUUID()}.pdf`;
  const { error: uploadError } = await supabase.storage
    .from("letters")
    .upload(path, letter, { contentType: "application/pdf" });
  if (uploadError) return { error: `Could not upload the letter: ${uploadError.message}` };

  const { data: requestId, error } = await supabase.rpc("create_request", {
    p_project: v.project,
    p_purpose: v.purpose,
    p_due: v.due_date,
    p_letter: path,
    p_lines: v.lines,
  });
  if (error) {
    await createAdminClient().storage.from("letters").remove([path]);
    return { error: error.message };
  }

  await notify(await adminRecipients(), {
    kind: "new_request",
    title: `New borrow request from ${profile.full_name}`,
    body: `${profile.full_name} (${profile.student_id}) requested ${v.lines.length} item type${v.lines.length === 1 ? "" : "s"} for "${v.project}", returning ${formatDate(v.due_date)}.`,
    link: `/requests/${requestId}`,
    dedupeKey: `new-request:${requestId}`,
  });

  revalidatePath("/requests");
  redirect(`/requests/${requestId}?created=1`);
}

interface ReviewTarget {
  id: string;
  project: string;
  due_date: string;
  profiles: { id: string; email: string; full_name: string };
}

async function loadTarget(id: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("requests")
    .select("id, project, due_date, profiles!requests_student_id_fkey(id, email, full_name)")
    .eq("id", id)
    .single<ReviewTarget>();
  return data;
}

function back(id: string, error?: string): never {
  revalidatePath("/requests");
  revalidatePath(`/requests/${id}`);
  revalidatePath("/inventory");
  revalidatePath("/dashboard");
  redirect(`/requests/${id}${error ? `?error=${encodeURIComponent(error)}` : ""}`);
}

export async function reviewRequest(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision"));
  const note = String(formData.get("note") ?? "");
  const supabase = await createClient();

  const { error } = await supabase.rpc(decision === "approve" ? "approve_request" : "reject_request", {
    p_id: id,
    p_note: note,
  });
  if (error) back(id, error.message);

  const target = await loadTarget(id);
  if (target) {
    const approved = decision === "approve";
    await notify([target.profiles], {
      kind: approved ? "request_approved" : "request_rejected",
      title: approved ? "Your borrow request was approved" : "Your borrow request was not approved",
      body: approved
        ? `You can collect the items for "${target.project}". Please return them by ${formatDate(target.due_date)}.${note ? `\n\nNote from admin: ${note}` : ""}`
        : `Your request for "${target.project}" was declined.${note ? `\n\nReason: ${note}` : ""}`,
      link: `/requests/${id}`,
      dedupeKey: `review:${id}`,
    });
    if (approved) await alertLowStock(id);
  }
  back(id);
}

/** Immediate admin alert when an approval pushes items to/below their low-stock level. */
async function alertLowStock(requestId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("request_items")
    .select("items(id, name, available_qty, low_stock_threshold)")
    .eq("request_id", requestId)
    .returns<{ items: { id: string; name: string; available_qty: number; low_stock_threshold: number } | null }[]>();
  const low = (data ?? []).map((r) => r.items!).filter((i) => i && i.available_qty <= i.low_stock_threshold);
  if (low.length === 0) return;
  await notify(await adminRecipients(), {
    kind: "low_stock",
    title: `Low stock: ${low.map((i) => i.name).join(", ")}`,
    body: low.map((i) => `• ${i.name}: only ${i.available_qty} left — consider ordering more`).join("\n"),
    link: "/inventory?filter=low",
    dedupeKey: `low-after:${requestId}`,
  });
}

export async function markReturned(formData: FormData) {
  await requireAdmin();
  const id = String(formData.get("id"));
  const lost: Record<string, number> = {};
  for (const [key, value] of formData) {
    if (key.startsWith("lost:") && Number(value) > 0) lost[key.slice(5)] = Math.floor(Number(value));
  }
  const supabase = await createClient();
  const { error } = await supabase.rpc("return_request", {
    p_id: id,
    p_note: String(formData.get("note") ?? ""),
    p_lost: lost,
  });
  if (error) back(id, error.message);

  const target = await loadTarget(id);
  if (target) {
    await notify([target.profiles], {
      kind: "returned",
      title: "Return received — thank you!",
      body: `The items for "${target.project}" have been checked back in.`,
      link: `/requests/${id}`,
      dedupeKey: `returned:${id}`,
    });
  }
  back(id);
}

