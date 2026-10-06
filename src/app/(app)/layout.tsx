import { requireUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { Sidebar } from "@/components/sidebar";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireUser();
  const supabase = await createClient();
  const isAdmin = profile.role === "admin";

  const [unread, pendingRequests, pendingUsers] = await Promise.all([
    supabase
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", profile.id)
      .eq("read", false),
    isAdmin
      ? supabase.from("requests").select("id", { count: "exact", head: true }).eq("status", "pending")
      : null,
    isAdmin
      ? supabase.from("profiles").select("id", { count: "exact", head: true }).eq("status", "pending")
      : null,
  ]);

  return (
    <div className="min-h-dvh lg:pl-72">
      <Sidebar
        profile={{ full_name: profile.full_name, student_id: profile.student_id, role: profile.role }}
        counts={{
          notifications: unread.count ?? 0,
          requests: pendingRequests?.count ?? 0,
          registrations: pendingUsers?.count ?? 0,
        }}
      />
      <main className="print-full mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        {children}
      </main>
    </div>
  );
}
