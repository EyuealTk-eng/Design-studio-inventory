"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";

const back = (tab: string, params: Record<string, string>): never =>
  redirect(`/registrations?${new URLSearchParams({ tab, ...params })}`);

/**
 * Permanently deletes an account (login + profile + notifications), which also frees
 * its student ID, email and phone so the real owner can register.
 * Accounts with borrow history are kept for the records — revoke access instead.
 */
export async function deleteAccount(formData: FormData) {
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const tab = String(formData.get("tab") ?? "pending");
  const db = createAdminClient();

  const { data: user } = await db
    .from("profiles")
    .select("id, full_name, email, phone, student_id, role, status")
    .eq("id", id)
    .maybeSingle();
  if (!user) back(tab, { err: "That account no longer exists." });
  if (user!.id === admin.id) back(tab, { err: "You can't delete your own account." });
  if (user!.role === "admin") back(tab, { err: `Remove admin rights from ${user!.full_name} before deleting the account.` });

  const { count } = await db.from("requests").select("id", { count: "exact", head: true }).eq("student_id", id);
  if (count) {
    back(tab, {
      err: `${user!.full_name} has borrow history (${count} request${count === 1 ? "" : "s"}), so the account is kept for the records. Use “Revoke access” instead.`,
    });
  }

  // A rejected sign-up gets told why before the account disappears.
  if (String(formData.get("reason")) === "reject") {
    await notify([user!], {
      kind: "account_rejected",
      title: "Your registration was not approved",
      body: "Please contact the Biomedical Design Studio admins if you think this is a mistake. You can register again with the correct details.",
      link: "/signup",
      sms: "Your studio inventory registration was not approved. Please contact the studio admins.",
      dedupeKey: `account:rejected:${Date.now()}`,
    });
  }

  const { error } = await db.auth.admin.deleteUser(id);
  if (error) back(tab, { err: `Could not delete the account: ${error.message}` });

  revalidatePath("/registrations");
  revalidatePath("/", "layout");
  back(tab, { msg: `${user!.full_name} (${user!.student_id}) was deleted. That student ID can be registered again.` });
}
