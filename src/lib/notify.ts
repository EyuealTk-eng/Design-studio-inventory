import "server-only";
import { Resend } from "resend";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";

export interface Recipient {
  id: string;
  email: string;
  full_name: string;
}

export interface Notice {
  kind: string;
  title: string;
  body: string;
  /** Path inside the app, e.g. /requests/123 */
  link?: string;
  /** Same key + same user is only ever delivered once. */
  dedupeKey: string;
}

/**
 * Records an in-app notification for each recipient and emails the ones that
 * have not already received this notice. Returns how many were newly sent.
 */
export async function notify(recipients: Recipient[], notice: Notice): Promise<number> {
  if (recipients.length === 0) return 0;
  const db = createAdminClient();
  const { data, error } = await db
    .from("notifications")
    .upsert(
      recipients.map((r) => ({
        user_id: r.id,
        kind: notice.kind,
        title: notice.title,
        body: notice.body,
        link: notice.link ?? null,
        dedupe_key: notice.dedupeKey,
      })),
      { onConflict: "user_id,dedupe_key", ignoreDuplicates: true },
    )
    .select("user_id");
  if (error) throw error;

  const fresh = new Set((data ?? []).map((row) => row.user_id as string));
  const toEmail = recipients.filter((r) => fresh.has(r.id));
  await Promise.all(toEmail.map((r) => sendEmail(r, notice)));
  return toEmail.length;
}

export async function adminRecipients(): Promise<Recipient[]> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, email, full_name")
    .eq("role", "admin")
    .eq("status", "approved");
  return data ?? [];
}

async function sendEmail(to: Recipient, notice: Notice) {
  const key = env.resendKey();
  const link = notice.link ? `${env.appUrl()}${notice.link}` : env.appUrl();
  if (!key) {
    console.info(`[email:dev] to=${to.email} subject="${notice.title}" link=${link}`);
    return;
  }
  try {
    await new Resend(key).emails.send({
      from: env.emailFrom(),
      to: to.email,
      subject: notice.title,
      html: emailHtml(to.full_name, notice, link),
    });
  } catch (err) {
    // Email failure must not break the action; the in-app notification still exists.
    console.error("Email send failed", err);
  }
}

function escapeHtml(s: string) {
  return s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
}

function emailHtml(name: string, notice: Notice, link: string) {
  return `<div style="font-family:Arial,sans-serif;max-width:520px;margin:auto;border:1px solid #dbeafe;border-radius:12px;overflow:hidden">
  <div style="background:#1d4ed8;color:#fff;padding:16px 20px;font-weight:bold">Biomedical Design Studio · Inventory</div>
  <div style="padding:20px;color:#0f172a;line-height:1.5">
    <p>Hi ${escapeHtml(name)},</p>
    <h2 style="font-size:18px;margin:0 0 8px">${escapeHtml(notice.title)}</h2>
    <p style="white-space:pre-line">${escapeHtml(notice.body)}</p>
    <p><a href="${link}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open inventory</a></p>
  </div></div>`;
}
