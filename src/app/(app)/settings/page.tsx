import type { Metadata } from "next";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireAdmin } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { formatDate, nextCheckin } from "@/lib/dates";
import type { Settings } from "@/lib/types";
import { Alert, Card, Field, Input, PageHeader } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export const metadata: Metadata = { title: "Settings" };

async function save(formData: FormData) {
  "use server";
  await requireAdmin();
  const n = (k: string) => Math.floor(Number(formData.get(k)));
  const values = {
    checkin_day: n("checkin_day"),
    checkin_notice_days: n("checkin_notice_days"),
    due_soon_days: n("due_soon_days"),
  };
  if (
    !(values.checkin_day >= 1 && values.checkin_day <= 28) ||
    !(values.checkin_notice_days >= 0 && values.checkin_notice_days <= 27) ||
    !(values.due_soon_days >= 0 && values.due_soon_days <= 30)
  ) {
    redirect("/settings?error=1");
  }
  const supabase = await createClient();
  await supabase.from("settings").update(values).eq("id", 1);
  revalidatePath("/", "layout");
  redirect("/settings?saved=1");
}

export default async function SettingsPage({ searchParams }: PageProps<"/settings">) {
  await requireAdmin();
  const { saved, error } = await searchParams;
  const supabase = await createClient();
  const { data: s } = await supabase.from("settings").select("*").single<Settings>();
  if (!s) return <Alert>Settings row is missing — run the database migration.</Alert>;

  return (
    <>
      <PageHeader title="Settings" description="When reminders and the monthly check-in happen." />
      <Card className="max-w-2xl p-6">
        <form action={save} className="flex flex-col gap-5">
          {saved && <Alert tone="green">Settings saved.</Alert>}
          {error && <Alert>Check the values: day 1–28, notice 0–27 days, reminder 0–30 days.</Alert>}
          <Field label="Monthly check-in day" htmlFor="checkin_day" hint={`Next check-in: ${formatDate(nextCheckin(s.checkin_day))}`}>
            <Input id="checkin_day" name="checkin_day" type="number" min={1} max={28} defaultValue={s.checkin_day} inputMode="numeric" />
          </Field>
          <Field label="Remind admins about the check-in this many days before" htmlFor="checkin_notice_days">
            <Input id="checkin_notice_days" name="checkin_notice_days" type="number" min={0} max={27} defaultValue={s.checkin_notice_days} inputMode="numeric" />
          </Field>
          <Field label="Remind borrowers this many days before their return date" htmlFor="due_soon_days" hint="Admins get a daily digest of the same list.">
            <Input id="due_soon_days" name="due_soon_days" type="number" min={0} max={30} defaultValue={s.due_soon_days} inputMode="numeric" />
          </Field>
          <div>
            <SubmitButton pendingText="Saving…">Save settings</SubmitButton>
          </div>
        </form>
      </Card>
      <p className="mt-4 max-w-2xl text-sm text-muted">
        Low-stock levels are set per item on each item&apos;s page. Alerts are emailed once a day by the scheduled job and also appear under Notifications.
      </p>
    </>
  );
}
