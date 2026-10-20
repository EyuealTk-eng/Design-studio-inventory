"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  BellRing,
  CalendarCheck,
  CheckCircle2,
  ChevronDown,
  ClipboardList,
  MessageSquare,
  PackageCheck,
  PackageX,
  ShieldAlert,
  UserCheck,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { Card, buttonClass, cx } from "@/components/ui";
import { markRead } from "./actions";

export interface NotificationView {
  id: string;
  kind: string;
  title: string;
  body: string;
  link: string | null;
  details: [string, string][] | null;
  read: boolean;
  ago: string;
  /** "Today", "Yesterday", "Monday, 13 Oct"… — the divider the item sits under. */
  day: string;
  when: string;
}

const ICONS: Record<string, LucideIcon> = {
  due_soon: BellRing,
  overdue: AlertTriangle,
  admin_due: BellRing,
  checkin: CalendarCheck,
  low_stock: PackageX,
  signup: UserPlus,
  duplicate_id: ShieldAlert,
  new_request: ClipboardList,
  request_approved: CheckCircle2,
  request_rejected: XCircle,
  account_approved: UserCheck,
  account_rejected: XCircle,
  returned: PackageCheck,
  message: MessageSquare,
};
const URGENT = new Set(["overdue", "low_stock", "request_rejected", "account_rejected", "duplicate_id"]);

/** Filter chips; each only shows when it has something in it. */
const CATEGORIES = [
  { key: "requests", label: "Requests", kinds: ["new_request", "request_approved", "request_rejected", "returned", "message"] },
  { key: "due", label: "Due dates", kinds: ["due_soon", "overdue", "admin_due", "checkin"] },
  { key: "stock", label: "Low stock", kinds: ["low_stock"] },
  { key: "accounts", label: "Registrations", kinds: ["signup", "account_approved", "account_rejected"] },
  { key: "duplicates", label: "Duplicate IDs", kinds: ["duplicate_id"] },
] as const;
type CategoryKey = "all" | "unread" | (typeof CATEGORIES)[number]["key"];

// Notifications sent before duplicate warnings had their own kind.
const kindOf = (n: NotificationView) =>
  n.kind === "signup" && n.title.startsWith("Duplicate student ID") ? "duplicate_id" : n.kind;

const LINK_LABEL: Record<string, string> = {
  new_request: "Review request",
  request_approved: "View request",
  request_rejected: "View request",
  due_soon: "View request",
  overdue: "View request",
  returned: "View request",
  message: "View request",
  signup: "Open registrations",
  duplicate_id: "Check the account",
  admin_due: "See due requests",
  low_stock: "See items to reorder",
  checkin: "Open check-in",
  account_approved: "Go to dashboard",
};

/** Older notifications have no structured details: show their text, bullet lines as a list. */
function Body({ text }: { text: string }) {
  const lines = text.split("\n").filter((l) => l.trim());
  const bullets = lines.filter((l) => l.trim().startsWith("•"));
  const prose = lines.filter((l) => !l.trim().startsWith("•"));
  return (
    <>
      {prose.map((l, i) => (
        <p key={i} className="text-[15px] leading-relaxed text-ink">{l}</p>
      ))}
      {bullets.length > 0 && (
        <ul className="mt-1 flex flex-col gap-1.5">
          {bullets.map((l, i) => (
            <li key={i} className="rounded-lg bg-surface px-3 py-2 text-sm text-ink">{l.replace(/^\s*•\s*/, "")}</li>
          ))}
        </ul>
      )}
    </>
  );
}

export function NotificationList({ items }: { items: NotificationView[] }) {
  const [open, setOpen] = useState<string | null>(null);
  const [readNow, setReadNow] = useState<Set<string>>(new Set());
  const [category, setCategory] = useState<CategoryKey>("all");
  const [, startTransition] = useTransition();

  const toggle = (n: NotificationView) => {
    setOpen((cur) => (cur === n.id ? null : n.id));
    if (!n.read && !readNow.has(n.id)) {
      setReadNow((s) => new Set(s).add(n.id));
      startTransition(() => markRead(n.id));
    }
  };

  const isUnread = (n: NotificationView) => !n.read && !readNow.has(n.id);
  const inCategory = (n: NotificationView, key: CategoryKey) =>
    key === "all" ||
    (key === "unread" ? isUnread(n) : (CATEGORIES.find((c) => c.key === key)?.kinds as readonly string[]).includes(kindOf(n)));
  const chips = [
    { key: "all" as CategoryKey, label: "All", count: items.length },
    { key: "unread" as CategoryKey, label: "Unread", count: items.filter(isUnread).length },
    ...CATEGORIES.map((c) => ({ key: c.key as CategoryKey, label: c.label, count: items.filter((n) => inCategory(n, c.key)).length })),
  ].filter((c) => c.key === "all" || c.key === category || c.count > 0);
  const shown = items.filter((n) => inCategory(n, category));

  // Consecutive notifications from the same day share one divider.
  const groups: { day: string; items: NotificationView[] }[] = [];
  for (const n of shown) {
    const last = groups.at(-1);
    if (last?.day === n.day) last.items.push(n);
    else groups.push({ day: n.day, items: [n] });
  }

  return (
    <>
      <nav aria-label="Notification categories" className="-mx-1 mb-4 flex gap-2 overflow-x-auto px-1 pb-1">
        {chips.map((c) => (
          <button
            key={c.key}
            type="button"
            onClick={() => setCategory(c.key)}
            aria-pressed={category === c.key}
            className={cx(
              "press inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 ring-inset transition-colors",
              category === c.key
                ? "bg-brand-600 text-white ring-brand-600"
                : cx("bg-card ring-line hover:text-ink", c.key === "duplicates" ? "text-bad" : "text-muted"),
            )}
          >
            {c.label}
            <span className={cx("tabular-nums", category === c.key ? "text-white/80" : "text-muted")}>{c.count}</span>
          </button>
        ))}
      </nav>
      {shown.length === 0 ? (
        <Card className="px-5 py-10 text-center text-sm text-muted">Nothing here.</Card>
      ) : (
        <div className="flex flex-col gap-2">
          {groups.map((g, gi) => (
            <section key={`${g.day}-${gi}`} aria-label={g.day}>
              <h2 className="my-3 flex items-center gap-3 text-xs font-semibold uppercase tracking-wide text-muted lg:top-0">
                <span className="h-px flex-1 bg-line" aria-hidden />
                <span className="rounded-full bg-surface px-3 py-1 ring-1 ring-line">{g.day}</span>
                <span className="h-px flex-1 bg-line" aria-hidden />
              </h2>
              <Card className="overflow-hidden">
                <NotificationRows items={g.items} open={open} isUnread={isUnread} toggle={toggle} />
              </Card>
            </section>
          ))}
        </div>
      )}
    </>
  );
}

function NotificationRows({
  items,
  open,
  isUnread,
  toggle,
}: {
  items: NotificationView[];
  open: string | null;
  isUnread: (n: NotificationView) => boolean;
  toggle: (n: NotificationView) => void;
}) {
  return (
    <ul className="divide-y divide-line">
      {items.map((n, i) => {
        const kind = kindOf(n);
        const Icon = ICONS[kind] ?? Bell;
        const unread = isUnread(n);
        const isOpen = open === n.id;
        const panelId = `notif-${n.id}`;
        return (
          <li
            key={n.id}
            className={cx("enter-up transition-colors duration-300", unread ? "bg-brand-50/50" : "bg-card")}
            style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
          >
            <button
              type="button"
              onClick={() => toggle(n)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="group flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-brand-50/70 active:bg-brand-100/60"
            >
              <Icon className={cx("mt-0.5 size-5 shrink-0", URGENT.has(kind) ? "text-bad" : "text-brand-600")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cx("truncate text-ink", unread ? "font-bold" : "font-medium")}>{n.title}</span>
                  {unread && <span className="size-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2 pt-0.5 text-xs text-muted">
                <time title={n.when}>{n.ago}</time>
                <ChevronDown className={cx("size-4 transition-transform duration-200", isOpen && "rotate-180")} aria-hidden />
              </span>
            </button>
            {/* grid-rows 0fr → 1fr animates the height without measuring it */}
            <div
              id={panelId}
              inert={!isOpen}
              className={cx("grid transition-[grid-template-rows] duration-300 ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
            >
              <div className="overflow-hidden">
                <div className={cx("flex flex-col gap-4 px-5 pb-5 pl-14 transition-opacity duration-300", isOpen ? "opacity-100" : "opacity-0")}>
                  {/* With a details list the sentence only repeats it; a message's text is its content. */}
                  {n.body && (!n.details?.length || n.kind === "message") && <Body text={n.body} />}
                  {n.details && n.details.length > 0 && (
                    <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 rounded-xl bg-surface p-4 sm:grid-cols-[minmax(8rem,auto)_1fr]">
                      {n.details.map(([k, v], j) => (
                        <div key={j} className="contents">
                          <dt className="text-sm text-muted">{k}</dt>
                          <dd className="whitespace-pre-line text-sm font-semibold text-ink [overflow-wrap:anywhere]">{v}</dd>
                        </div>
                      ))}
                    </dl>
                  )}
                  <div className="flex flex-wrap items-center gap-3">
                    {n.link && (
                      <Link href={n.link} className={buttonClass("primary")}>
                        {LINK_LABEL[kind] ?? "Open"} <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    )}
                    <span className="text-xs text-muted">{n.when}</span>
                  </div>
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
