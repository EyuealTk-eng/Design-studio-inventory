import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/lib/types";

export interface AppContext {
  profile: Profile;
  unread: number;
  pending_requests: number;
  pending_users: number;
  /** Admins only: members seen in the last 5 minutes (0 before migration 0005). */
  online: number;
}

/**
 * The signed-in user's profile and sidebar counters in one database call, cached per request
 * (the layout and the page share it). The database verifies the session token itself, so this
 * needs no separate round trip to the auth server.
 */
export const getAppContext = cache(async (): Promise<AppContext | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("app_context");
  if (!error) return data ? { ...(data as AppContext), online: (data as AppContext).online ?? 0 } : null;
  // Migration 0004 not applied yet: fall back to separate queries so nobody gets locked out.
  if (error.code !== "PGRST202" && error.code !== "42883") return null;
  const { data: claims } = await supabase.auth.getClaims();
  const uid = claims?.claims?.sub;
  if (!uid) return null;
  const { data: profile } = await supabase.from("profiles").select("*").eq("id", uid).single();
  if (!profile) return null;
  const isAdmin = profile.role === "admin";
  const count = async (q: PromiseLike<{ count: number | null }>) => (await q).count ?? 0;
  const [unread, pending_requests, pending_users] = await Promise.all([
    count(supabase.from("notifications").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("read", false)),
    isAdmin ? count(supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "pending")) : 0,
    isAdmin ? count(supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending")) : 0,
  ]);
  return { profile: profile as Profile, unread, pending_requests, pending_users, online: 0 };
});

/** The signed-in, approved user's profile, or null. */
export const getCurrentProfile = cache(async (): Promise<Profile | null> => {
  const ctx = await getAppContext();
  if (!ctx || ctx.profile.status !== "approved") return null;
  return ctx.profile;
});

export async function requireUser(): Promise<Profile> {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");
  return profile;
}

export async function requireAdmin(): Promise<Profile> {
  const profile = await requireUser();
  if (profile.role !== "admin") redirect("/dashboard");
  return profile;
}
