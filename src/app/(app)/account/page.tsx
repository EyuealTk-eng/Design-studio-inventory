import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatPhone, normalisePhone } from "@/lib/phone";
import { Alert, Card, Field, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "My account" };

async function savePhone(formData: FormData) {
  "use server";
  const me = await requireUser();
  const raw = String(formData.get("phone") ?? "");
  const phone = normalisePhone(raw);
  if (raw.trim() && !phone) redirect("/account?error=1");
  // Users may only change their own phone; RLS doesn't let students update profiles directly.
  await createAdminClient().from("profiles").update({ phone }).eq("id", me.id);
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
      <PageHeader title="My account" description="Where we send your reminders." />
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
            {error && <Alert>That doesn&apos;t look like a phone number. Try 0911 234 567.</Alert>}
            <Field
              label="Phone number for SMS reminders"
              htmlFor="phone"
              hint={me.phone ? `Currently ${formatPhone(me.phone)}. Leave empty to stop SMS.` : "Add your number to get SMS reminders."}
            >
              <Input id="phone" name="phone" type="tel" inputMode="tel" autoComplete="tel" defaultValue={me.phone ? formatPhone(me.phone) : ""} placeholder="0911 234 567" />
            </Field>
            <div>
              <SubmitButton pendingText="Saving…">Save</SubmitButton>
            </div>
          </form>
        </Card>
      </div>
    </>
  );
}
