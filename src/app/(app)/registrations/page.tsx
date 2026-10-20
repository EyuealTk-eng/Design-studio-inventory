import type { Metadata } from "next";
import Link from "next/link";
import { revalidatePath } from "next/cache";
import { Check, Trash2, UserCheck, X } from "lucide-react";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { notify } from "@/lib/notify";
import { formatDate } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import type { Profile } from "@/lib/types";
import { Alert, Badge, Card, EmptyState, PageHeader, cx } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { ConfirmSubmit } from "@/components/confirm-submit";
import { deleteAccount } from "./actions";

export const metadata: Metadata = { title: "Registrations" };

async function decide(formData: FormData) {
  "use server";
  const admin = await requireAdmin();
  const id = String(formData.get("id"));
  const decision = String(formData.get("decision"));
  const supabase = await createClient();

  if (decision === "admin" || decision === "student") {
    if (id === admin.id) return; // can't demote yourself
    await supabase.from("profiles").update({ role: decision }).eq("id", id);
    revalidatePath("/registrations");
    return;
  }

  const status = decision === "approve" ? "approved" : "rejected";
  const { data: user } = await supabase
    .from("profiles")
    .update({ status, reviewed_at: new Date().toISOString(), reviewed_by: admin.id })
    .eq("id", id)
    .neq("id", admin.id)
    .select("id, email, full_name, phone, student_id")
    .single();
  if (user) {
    await notify([user], {
      kind: status === "approved" ? "account_approved" : "account_rejected",
      title: status === "approved" ? "Your studio account is approved" : "Your studio access was revoked",
      body:
        status === "approved"
          ? "Welcome to the studio! Sign in with your student ID and the password you chose."
          : "Please contact the Biomedical Design Studio admins if you think this is a mistake.",
      details:
        status === "approved"
          ? [
              ["Name", user.full_name],
              ["Student ID", user.student_id],
              ["Sign in with", "Your student ID + password"],
              ["You can now", "Browse the inventory and borrow items"],
            ]
          : [["Student ID", user.student_id]],
      link: "/login",
      sms:
        status === "approved"
          ? `Your studio inventory account is approved. Sign in with your student ID ${user.student_id}.`
          : "Your studio inventory access was revoked. Please contact the studio admins.",
      dedupeKey: `account:${status}:${new Date().toISOString().slice(0, 10)}`,
    });
  }
  revalidatePath("/registrations");
  revalidatePath("/", "layout");
}

const TABS = [
  { key: "pending", label: "Waiting" },
  { key: "approved", label: "Approved" },
  { key: "rejected", label: "Access revoked" },
] as const;

export default async function RegistrationsPage({ searchParams }: PageProps<"/registrations">) {
  const me = await requireAdmin();
  const { tab: rawTab, msg, err } = await searchParams;
  const tab = TABS.some((t) => t.key === rawTab) ? (rawTab as string) : "pending";
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("status", tab)
    .order("created_at", { ascending: tab !== "pending" ? false : true })
    .returns<Profile[]>();
  const people = data ?? [];

  return (
    <>
      <PageHeader title="Registrations" description="Students who signed up and are waiting for access." />
      {(typeof msg === "string" || typeof err === "string") && (
        <div className="mb-4">
          {typeof msg === "string" && <Alert tone="green">{msg}</Alert>}
          {typeof err === "string" && <Alert>{err}</Alert>}
        </div>
      )}
      <nav aria-label="Registration status" className="mb-4 flex gap-2">
        {TABS.map((t) => (
          <Link
            key={t.key}
            href={`/registrations?tab=${t.key}`}
            aria-current={tab === t.key ? "page" : undefined}
            className={cx(
              "inline-flex min-h-9 items-center rounded-full px-3.5 text-sm font-semibold ring-1 ring-inset",
              tab === t.key ? "bg-brand-600 text-white ring-brand-600" : "bg-card text-muted ring-line hover:text-ink",
            )}
          >
            {t.label}
          </Link>
        ))}
      </nav>
      <Card className="overflow-hidden">
        {people.length === 0 ? (
          <EmptyState icon={<UserCheck className="size-6" />} title={tab === "pending" ? "No one is waiting" : "Nobody here yet"}>
            {tab === "pending" && "New sign-ups will appear here for approval."}
          </EmptyState>
        ) : (
          <ul className="divide-y divide-line">
            {people.map((p, i) => (
              <li key={p.id} className="enter-up flex flex-col gap-3 px-5 py-4 md:flex-row md:items-center" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-semibold">{p.full_name}</p>
                    {p.role === "admin" && <Badge>Admin</Badge>}
                  </div>
                  <p className="text-sm text-muted">
                    <span className="font-mono">{p.student_id}</span> · {p.department}, year {p.year} · {p.email}
                    {p.phone && <> · {formatPhone(p.phone)}</>}
                  </p>
                  <p className="text-xs text-muted">Registered {formatDate(p.created_at)}</p>
                </div>
                {p.id !== me.id && (
                  <div className="flex flex-wrap gap-2">
                    <form action={decide} className="flex flex-wrap gap-2">
                      <input type="hidden" name="id" value={p.id} />
                      {p.status !== "approved" && (
                        <SubmitButton name="decision" value="approve">
                          <Check className="size-4" aria-hidden /> {p.status === "rejected" ? "Restore access" : "Approve"}
                        </SubmitButton>
                      )}
                      {p.status === "approved" && (
                        <SubmitButton name="decision" value="reject" variant="danger">
                          <X className="size-4" aria-hidden /> Revoke access
                        </SubmitButton>
                      )}
                      {p.status === "approved" && (
                        <SubmitButton name="decision" value={p.role === "admin" ? "student" : "admin"} variant="secondary">
                          {p.role === "admin" ? "Remove admin" : "Make admin"}
                        </SubmitButton>
                      )}
                    </form>
                    {p.role !== "admin" && (
                      <form action={deleteAccount}>
                        <input type="hidden" name="id" value={p.id} />
                        <input type="hidden" name="tab" value={tab} />
                        {p.status === "pending" ? (
                          <>
                            <input type="hidden" name="reason" value="reject" />
                            <ConfirmSubmit message={`Reject and delete the registration for ${p.full_name} (${p.student_id})? The student ID becomes free to register again.`}>
                              <X className="size-4" aria-hidden /> Reject
                            </ConfirmSubmit>
                          </>
                        ) : (
                          <ConfirmSubmit message={`Permanently delete ${p.full_name}'s account (${p.student_id})? This can't be undone.`}>
                            <Trash2 className="size-4" aria-hidden /> Delete account
                          </ConfirmSubmit>
                        )}
                      </form>
                    )}
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
