"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { adminRecipients, notify } from "@/lib/notify";
import { normalisePhone } from "@/lib/phone";
import { canonicalStudentId, STUDENT_ID_PATTERN } from "@/lib/student-id";

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

const normaliseId = canonicalStudentId;
const nameField = (label: string) =>
  z
    .string()
    .trim()
    .min(1, `Enter your ${label}`)
    .max(60)
    .regex(/^[\p{L}][\p{L}' .-]*$/u, `Use letters only for your ${label}`);

const signupSchema = z
  .object({
    first_name: nameField("first name"),
    last_name: nameField("last name"),
    student_id: z
      .string()
      .transform(canonicalStudentId)
      .refine((v) => v.length > 0, "Enter your student ID")
      .refine((v) => STUDENT_ID_PATTERN.test(v), "Use the format on your ID card, e.g. UGR/2154/17"),
    email: z.string().trim().toLowerCase().email("Enter a valid email address"),
    phone: z
      .string()
      .transform((v) => normalisePhone(v))
      .refine((v): v is string => v !== null, "Enter a phone number like 0911 234 567"),
    department: z.string().trim().min(2, "Enter your department").max(120),
    year: z
      .string({ error: "Choose your year" })
      .regex(/^[1-8]$/, "Choose your year")
      .transform(Number),
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
  const v = { ...parsed.data, full_name: `${parsed.data.first_name} ${parsed.data.last_name}` };
  const studentId = v.student_id;
  const db = createAdminClient();

  const [{ data: idOwner, error: lookupError }, { count: emailTaken }, { count: phoneTaken }] = await Promise.all([
    db.from("profiles").select("id, full_name, status").eq("student_id", studentId).maybeSingle(),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("email", v.email),
    db.from("profiles").select("id", { count: "exact", head: true }).eq("phone", v.phone),
  ]);
  if (lookupError) {
    console.error("signup: profiles lookup failed", lookupError);
    return {
      error: `The site isn't connected to its database correctly (${lookupError.message || lookupError.code}). Please tell an admin.`,
      values: echo(formData),
    };
  }
  if (idOwner) {
    // Someone may be trying to use another student's ID: tell the admins.
    await notify(await adminRecipients(), {
      kind: "signup",
      title: `Duplicate student ID attempt: ${studentId}`,
      body: `${v.full_name} (${v.email}, ${v.phone}) tried to register with ${studentId}, which already belongs to ${idOwner.full_name} (${idOwner.status}). If the existing account isn't the real owner, delete it on the Registrations page.`,
      link: "/registrations?tab=" + idOwner.status,
      dedupeKey: `dup-id:${studentId}:${v.email}`,
    });
    return {
      fieldErrors: {
        student_id: "This student ID is already registered. If it's yours and you didn't register it, contact the studio admins — they've been notified.",
      },
      values: echo(formData),
    };
  }
  if (emailTaken) return { fieldErrors: { email: "This email is already registered" }, values: echo(formData) };
  if (phoneTaken) return { fieldErrors: { phone: "This phone number is already registered" }, values: echo(formData) };

  const { data: created, error } = await db.auth.admin.createUser({
    email: v.email,
    password: v.password,
    email_confirm: true,
  });
  if (error || !created.user) {
    console.error("signup: createUser failed", error);
    if (error?.message.includes("already")) {
      return { fieldErrors: { email: "This email is already registered" }, values: echo(formData) };
    }
    // "User not allowed" / 401 / 403 means SUPABASE_SERVICE_ROLE_KEY is not the service_role key.
    const keyProblem = error?.status === 401 || error?.status === 403 || /not allowed|invalid api key|jwt/i.test(error?.message ?? "");
    return {
      error: keyProblem
        ? `The site's database key is wrong (${error?.message}). An admin needs to check SUPABASE_SERVICE_ROLE_KEY in Vercel.`
        : `Could not create your account (${error?.message ?? "unknown error"}). Please try again or tell an admin.`,
      values: echo(formData),
    };
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
    console.error("signup: profile insert failed", profileError);
    await db.auth.admin.deleteUser(created.user.id);
    if (profileError.code === "23505") {
      // Unique constraint lost a race with a simultaneous registration.
      const field = profileError.message.includes("phone") ? "phone" : profileError.message.includes("email") ? "email" : "student_id";
      return { fieldErrors: { [field]: "This is already registered" }, values: echo(formData) };
    }
    return {
      error: `Could not save your registration (${profileError.message}). Please try again or tell an admin.`,
      values: echo(formData),
    };
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
  const rawId = String(formData.get("student_id") ?? "");
  const studentId = normaliseId(rawId);
  const password = String(formData.get("password") ?? "");
  const values = { student_id: studentId };
  if (!studentId || !password) return { error: "Enter your student ID and password", values };

  const generic = { error: "Incorrect student ID or password", values };
  const { data: profile } = await createAdminClient()
    .from("profiles")
    .select("email")
    // canonical spelling first; also accept IDs saved before canonicalisation
    .in("student_id", [...new Set([studentId, rawId.trim().toUpperCase()])])
    .limit(1)
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
