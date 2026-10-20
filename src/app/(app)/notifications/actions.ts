"use server";

import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

/** Marks one of the signed-in user's notifications as read (RLS limits it to their own). */
export async function markRead(id: string) {
  const me = await requireUser();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("id", id).eq("user_id", me.id);
  revalidatePath("/", "layout");
}

export async function markAllRead() {
  const me = await requireUser();
  const supabase = await createClient();
  await supabase.from("notifications").update({ read: true }).eq("user_id", me.id).eq("read", false);
  revalidatePath("/", "layout");
}
