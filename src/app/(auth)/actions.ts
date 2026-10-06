"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminRecipients, notify } from "@/lib/notify";
import { normalisePhone } from "@/lib/phone";

export interface FormState {
  error?: string;
  fieldErrors?: Record<string, string>;
  success?: string;
  /** Submitted values echoed back so the form keeps them after an error. */
  values?: Record<string, string>;
}

function echo(formData: FormData) {
  const values: Record<string, string> = {};
  for (const [k, v] of formData) if (typeof v === "string" && !k.startsWith("$") && !/password|confirm/.test(k)) values[k] = v;
  return values;
}

const normaliseId = (id: string) => id.trim().toUpperCase();

const signupSchema = z
  .object({
    full_name: z.string().trim().min(3, "Enter your full name").max(120),
    student_id: z
      .string()
      .trim()
      .min(3, "Enter your student ID")
      .max(40)
      .regex(/^[A-Za-z0-9/_-]+$/, "Use letters, numbers, / - or _ only"),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    phone: z
      .string()
      .transform((v) => normalisePhone(v))
      .refine((v): v is string => v !== null, "Enter a phone number like 0911 234 567"),
    department: z.string().trim().min(2, "Enter your department").max(120),
    year: z.coerce.number().int().min(1, "Choose your year").max(8),
    password: z.string().min(8, "Use at least 8 characters").max(72),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match" });

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  const parsed = signupSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] ??= issue.message;
    return { fieldErrors, values: echo(formData) };
  }
  const v = parsed.data;
  const studentId = normaliseId(v.student_id);
  const db = createAdminClient();

  const [{ count: idTaken }, { count: emailTaken }] = await Promise.all([
    db.from("profiles").select("id", { count: "exact", head: true }).eq("student_id", studentId),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("email", v.email),
  ]);
  if (idTaken) return { fieldErrors: { student_id: "This student ID is already registered" }, values: echo(formData) };
  if (emailTaken) return { fieldErrors: { email: "This email is already registered" }, values: echo(formData) };

  const { data: created, error } = await db.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
  });
  if (error || !created.user) {
    return { error: error?.message.includes("already") ? "This email is already registered" : "Could not create your account. Please try again." };
  }

  const { error: profileError } = await db.from("profiles").insert({
    id: created.user.id,
    full_name: v.full_name,
    student_id: studentId,
    email: v.email,
    phone: v.phone,
    department: v.department,
    year: v.year,
  });
  if (profileError) {
    await db.auth.admin.deleteUser(created.user.id);
    return { error: "Could not save your registration. Please try again." };
  }

  await notify(await adminRecipients(), {
    kind: "signup",
    title: `New registration: ${v.full_name}`,
    body: `${v.full_name} (${studentId}), ${v.department} year ${v.year}, is waiting for approval.`,
    link: "/registrations",
    dedupeKey: `signup:${created.user.id}`,
    sms: `New registration waiting for approval: ${v.full_name} (${studentId}).`,
  });

  return {
    success: "Registration sent! An admin will review it — you can sign in with your student ID once approved.",
  };
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const studentId = normaliseId(String(formData.get("student_id") ?? ""));
  const password = String(formData.get("password") ?? "");
  const values = { student_id: studentId };
  if (!studentId || !password) return { error: "Enter your student ID and password", values };

  const generic = { error: "Incorrect student ID or password", values };
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("email")
    .eq("student_id", studentId)
    .maybeSingle();
  if (!profile) return generic;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email: profile.email, password });
  if (error || !data.user) return generic;

  // Status is only revealed after the password is verified.
  const { data: me } = await supabase.from("profiles").select("status").eq("id", data.user.id).single();
  if (me?.status !== "approved") {
    await supabase.auth.signOut();
    return {
      values,
      error:
        me?.status === "rejected"
          ? "Your registration was not approved. Please contact the studio admins."
          : "Your registration is still waiting for admin approval.",
    };
  }

  const next = String(formData.get("next") ?? "");
  redirect(next.startsWith("/") && !next.startsWith("//") ? next : "/dashboard");
}

export async function logout() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/login");
}
