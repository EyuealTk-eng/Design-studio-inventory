"use server";

import { createClient } from "@/lib/supabase/server";

/** Presence heartbeat (no-op until migration 0005 is applied). */
export async function ping() {
  const supabase = await createClient();
  await supabase.rpc("touch_presence");
}
