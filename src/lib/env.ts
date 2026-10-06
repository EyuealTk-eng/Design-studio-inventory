function required(name: string, value: string | undefined): string {
  if (!value) throw new Error(`Missing environment variable ${name} (see .env.example)`);
  return value;
}

/**
 * Supabase's dashboard shows URLs like https://x.supabase.co/rest/v1/ — the
 * client needs just the origin, so anything after the host is dropped.
 */
export function supabaseOrigin(raw: string | undefined): string | undefined {
  if (!raw) return raw;
  try {
    return new URL(raw.trim().replace(/^["']|["']$/g, "")).origin;
  } catch {
    return raw.trim();
  }
}

// Read lazily so `next build` works without secrets present.
export const env = {
  supabaseUrl: () =>
    required("NEXT_PUBLIC_SUPABASE_URL", supabaseOrigin(process.env.NEXT_PUBLIC_SUPABASE_URL)),
  supabaseAnonKey: () =>
    required("NEXT_PUBLIC_SUPABASE_ANON_KEY", process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
  serviceRoleKey: () =>
    required("SUPABASE_SERVICE_ROLE_KEY", process.env.SUPABASE_SERVICE_ROLE_KEY?.trim()),
  appUrl: () => (process.env.APP_URL?.trim() || "http://localhost:3000").replace(/\/+$/, ""),
  resendKey: () => process.env.RESEND_API_KEY,
  emailFrom: () => process.env.EMAIL_FROM ?? "Design Studio <onboarding@resend.dev>",
  cronSecret: () => process.env.CRON_SECRET,
};
