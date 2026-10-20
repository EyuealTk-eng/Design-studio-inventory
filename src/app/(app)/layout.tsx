import { getAppContext, requireUser } from "@/lib/auth";
import { Sidebar } from "@/components/sidebar";
import { Presence } from "@/components/presence";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const profile = await requireUser();
  const ctx = (await getAppContext())!; // same cached call as requireUser

  return (
    <div className="min-h-dvh lg:pl-72">
      <Sidebar
        profile={{ full_name: profile.full_name, student_id: profile.student_id, role: profile.role }}
        counts={{
          notifications: ctx.unread,
          requests: ctx.pending_requests,
          registrations: ctx.pending_users,
          online: ctx.online,
        }}
      />
      <Presence />
      <main className="print-full mx-auto max-w-7xl px-4 pb-16 pt-6 sm:px-6 lg:px-10 lg:pt-10">
        {children}
      </main>
    </div>
  );
}
