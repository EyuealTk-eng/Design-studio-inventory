import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhone, normalisePhone } from "@/lib/phone";
import { Alert, Card, Field, Input, PageHeader } from "@/components/ui";
import { ThemeSwitch } from "@/components/theme-switch";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "My account" };

async function savePhone(formData: FormData) {
  "use server";
  const me = await requireUser();
  const raw = String(formData.get("phone") ?? "");
  const phone = normalisePhone(raw);
  if (!raw.trim()) redirect("/account?error=required");
  if (!phone) redirect("/account?error=invalid");
  // Users may only change their own phone; RLS doesn't let students update profiles directly.
  const { error } = await createAdminClient().from("profiles").update({ phone }).eq("id", me.id);
  if (error) redirect(`/account?error=${error.code === "23505" ? "taken" : "invalid"}`);
  revalidatePath("/account");
  redirect("/account?saved=1");
}

export default async function AccountPage({ searchParams }: PageProps<"/account">) {
  const me = await requireUser();
  const { saved, error } = await searchParams;
  const rows = [
    ["Name", me.full_name],
    ["Student ID", me.student_id],
    ["Email", me.email],
    ["Department", `${me.department}, year ${me.year}`],
    ["Role", me.role === "admin" ? "Admin" : "Student"],
  ];

  return (
    <>
      <PageHeader title="My account" description="Your details, reminders and appearance." />
      <div className="grid max-w-3xl gap-6">
        <Card className="p-6">
          <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-[10rem_1fr]">
            {rows.map(([k, v]) => (
              <div key={k} className="contents">
                <dt className="text-sm font-semibold text-muted">{k}</dt>
                <dd className="text-ink">{v}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card className="p-6">
          <form action={savePhone} className="flex flex-col gap-4">
            {saved && <Alert tone="green">Phone number saved.</Alert>}
            {!me.phone && !error && me.role === "student" && (
              <Alert tone="blue">Add your phone number — you can&apos;t borrow items until you do.</Alert>
            )}
            {error === "required" && <Alert>Your phone number is required.</Alert>}
            {error === "invalid" && <Alert>That doesn&apos;t look like a phone number. Try 0911 234 567.</Alert>}
            {error === "taken" && <Alert>That phone number is already used by another account.</Alert>}
            <Field
              label="Phone number"
              htmlFor="phone"
              hint={me.phone ? `Currently ${formatPhone(me.phone)}.` : "Required for SMS return reminders."}
              required
            >
              <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={me.phone ? formatPhone(me.phone) : ""} placeholder="0911 234 567" required />
            </Field>
            <div>
              <SubmitButton pendingText="Saving…">Save</SubmitButton>
            </div>
          </form>
        </Card>
        <Card className="p-6">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-muted">Appearance</h2>
          <ThemeSwitch />
        </Card>
      </div>
    </>
  );
}
