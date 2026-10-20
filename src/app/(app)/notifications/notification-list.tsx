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
  UserCheck,
  UserPlus,
  XCircle,
  type LucideIcon,
} from "lucide-react";
import { buttonClass, cx } from "@/components/ui";
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
  when: string;
}

const ICONS: Record<string, LucideIcon> = {
  due_soon: BellRing,
  overdue: AlertTriangle,
  admin_due: BellRing,
  checkin: CalendarCheck,
  low_stock: PackageX,
  signup: UserPlus,
  new_request: ClipboardList,
  request_approved: CheckCircle2,
  request_rejected: XCircle,
  account_approved: UserCheck,
  account_rejected: XCircle,
  returned: PackageCheck,
  message: MessageSquare,
};
const URGENT = new Set(["overdue", "low_stock", "request_rejected", "account_rejected"]);

const LINK_LABEL: Record<string, string> = {
  new_request: "Review request",
  request_approved: "View request",
  request_rejected: "View request",
  due_soon: "View request",
  overdue: "View request",
  returned: "View request",
  message: "View request",
  signup: "Open registrations",
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
  const [, startTransition] = useTransition();

  const toggle = (n: NotificationView) => {
    setOpen((cur) => (cur === n.id ? null : n.id));
    if (!n.read && !readNow.has(n.id)) {
      setReadNow((s) => new Set(s).add(n.id));
      startTransition(() => markRead(n.id));
    }
  };

  return (
    <ul className="divide-y divide-line">
      {items.map((n, i) => {
        const Icon = ICONS[n.kind] ?? Bell;
        const unread = !n.read && !readNow.has(n.id);
        const isOpen = open === n.id;
        const panelId = `notif-${n.id}`;
        return (
          <li
            key={n.id}
            className={cx("enter-up transition-colors duration-300", unread ? "bg-brand-50/50" : "bg-white")}
            style={{ animationDelay: `${Math.min(i, 10) * 40}ms` }}
          >
            <button
              type="button"
              onClick={() => toggle(n)}
              aria-expanded={isOpen}
              aria-controls={panelId}
              className="group flex w-full items-start gap-4 px-5 py-4 text-left transition-colors hover:bg-brand-50/70 active:bg-brand-100/60"
            >
              <Icon className={cx("mt-0.5 size-5 shrink-0", URGENT.has(n.kind) ? "text-bad" : "text-brand-600")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2">
                  <span className={cx("truncate text-ink", unread ? "font-bold" : "font-medium")}>{n.title}</span>
                  {unread && <span className="size-2 shrink-0 rounded-full bg-brand-600" aria-label="Unread" />}
                </span>
                {!isOpen && <span className="mt-0.5 block truncate text-sm text-muted">{n.body.split("\n")[0]}</span>}
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
                  {n.body && <Body text={n.body} />}
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
                        {LINK_LABEL[n.kind] ?? "Open"} <ArrowRight className="size-4" aria-hidden />
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
