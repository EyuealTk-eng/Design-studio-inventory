const TZ = process.env.APP_TIMEZONE ?? "Africa/Addis_Ababa";

/** Today's date in the studio's time zone as YYYY-MM-DD. */
export function today(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(new Date());
}

/** Whole days from `from` to `to` (both YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(to) - Date.parse(from)) / 86_400_000);
}

export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** The next monthly check-in date on or after `from`. */
export function nextCheckin(checkinDay: number, from: string = today()): string {
  const [y, m, d] = from.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (d <= checkinDay) return `${y}-${pad(m)}-${pad(checkinDay)}`;
  const ny = m === 12 ? y + 1 : y;
  const nm = m === 12 ? 1 : m + 1;
  return `${ny}-${pad(nm)}-${pad(checkinDay)}`;
}

export function formatDate(date: string | null | undefined): string {
  if (!date) return "—";
  const d = new Date(date.length === 10 ? `${date}T00:00:00Z` : date);
  return d.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: date.length === 10 ? "UTC" : TZ,
  });
}

/** Human label for a due date relative to today, e.g. "in 2 days", "3 days overdue". */
export function dueLabel(due: string, now: string = today()): string {
  const n = daysBetween(now, due);
  if (n === 0) return "due today";
  if (n === 1) return "due tomorrow";
  if (n > 1) return `in ${n} days`;
  return `${-n} day${n === -1 ? "" : "s"} overdue`;
}
