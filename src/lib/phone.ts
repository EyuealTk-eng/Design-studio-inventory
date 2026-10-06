/**
 * Normalises a phone number to international (E.164) format.
 * Ethiopian local formats are accepted: 0911 234 567, 0711234567, 911234567, 251911234567.
 * Returns null when the input isn't a usable number.
 */
export function normalisePhone(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;
  const digits = raw.replace(/[^\d]/g, "");
  if (raw.startsWith("+")) return /^[1-9]\d{7,14}$/.test(digits) ? `+${digits}` : null;
  if (/^251[79]\d{8}$/.test(digits)) return `+${digits}`;
  if (/^0[79]\d{8}$/.test(digits)) return `+251${digits.slice(1)}`;
  if (/^[79]\d{8}$/.test(digits)) return `+251${digits}`;
  return null;
}

/** +251911234567 → 0911 234 567 for display; other countries unchanged. */
export function formatPhone(phone: string | null | undefined): string {
  if (!phone) return "—";
  const m = /^\+251(\d{3})(\d{3})(\d{3})$/.exec(phone);
  return m ? `0${m[1]} ${m[2]} ${m[3]}` : phone;
}
