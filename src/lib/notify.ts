import "server-only";
import { Resend } from "resend";
import nodemailer, { type Transporter } from "nodemailer";
import { createAdminClient } from "@/lib/supabase/admin";
import { env } from "@/lib/env";
import { sendSms } from "@/lib/sms";

export interface Recipient {
  id: string;
  email: string;
  full_name: string;
  phone?: string | null;
}

export interface Notice {
  kind: string;
  title: string;
  body: string;
  /** Path inside the app, e.g. /requests/123 */
  link?: string;
  /** Same key + same user is only ever delivered once. */
  dedupeKey: string;
  /** Short text for an SMS. Omit to send email + in-app only. */
  sms?: string;
}

export interface DeliveryResult {
  /** Recipients that hadn't already received this notice. */
  sent: number;
  emailed: number;
  texted: number;
}

/**
 * Records an in-app notification for each recipient, then emails (and texts,
 * when `notice.sms` is set and they have a phone) the ones that have not
 * already received this notice.
 */
export async function deliver(recipients: Recipient[], notice: Notice): Promise<DeliveryResult> {
  const result = { sent: 0, emailed: 0, texted: 0 };
  if (recipients.length === 0) return result;
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
    .select("id, user_id");
  if (error) throw error;

  const rowFor = new Map((data ?? []).map((row) => [row.user_id as string, row.id as string]));
  const fresh = recipients.filter((r) => rowFor.has(r.id));
  result.sent = fresh.length;

  await Promise.all(
    fresh.map(async (r) => {
      const [emailed, texted] = await Promise.all([
        sendEmail(r, notice),
        notice.sms && r.phone ? sendSms(r.phone, `${notice.sms}\n- BME Design Studio`) : false,
      ]);
      if (emailed) result.emailed++;
      if (texted) result.texted++;
      if (emailed || texted) {
        await db.from("notifications").update({ emailed, texted }).eq("id", rowFor.get(r.id)!);
      }
    }),
  );
  return result;
}

/** Same as deliver(), returning just how many recipients were newly notified. */
export async function notify(recipients: Recipient[], notice: Notice): Promise<number> {
  return (await deliver(recipients, notice)).sent;
}

export async function adminRecipients(): Promise<Recipient[]> {
  const { data } = await createAdminClient()
    .from("profiles")
    .select("id, email, full_name, phone")
    .eq("role", "admin")
    .eq("status", "approved");
  return data ?? [];
}

// ------------------------------------------------------------------ email

let smtp: Transporter | null = null;

/**
 * Sends via SMTP when SMTP_HOST is set (e.g. the studio's Gmail with an app
 * password), otherwise via Resend when RESEND_API_KEY is set, otherwise logs.
 * Returns true when the message was handed to a mail server.
 */
async function sendEmail(to: Recipient, notice: Notice): Promise<boolean> {
  const link = notice.link ? `${env.appUrl()}${notice.link}` : env.appUrl();
  const message = {
    from: env.emailFrom(),
    to: to.email,
    subject: notice.title,
    text: `Hi ${to.full_name},\n\n${notice.title}\n\n${notice.body}\n\nOpen inventory: ${link}`,
    html: emailHtml(to.full_name, notice, link),
  };
  try {
    if (process.env.SMTP_HOST) {
      smtp ??= nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT ?? 465),
        secure: Number(process.env.SMTP_PORT ?? 465) === 465,
        auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
      });
      await smtp.sendMail(message);
      return true;
    }
    const key = env.resendKey();
    if (key) {
      const { error } = await new Resend(key).emails.send(message);
      if (error) throw new Error(error.message);
      return true;
    }
    console.info(`[email:dev] to=${to.email} subject="${notice.title}" link=${link}`);
    return false;
  } catch (err) {
    // Email failure must not break the action; the in-app notification still exists.
    console.error("Email send failed", err);
    return false;
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
    <p><a href="${escapeHtml(link)}" style="display:inline-block;background:#1d4ed8;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none">Open inventory</a></p>
  </div></div>`;
}
