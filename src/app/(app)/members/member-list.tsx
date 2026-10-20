"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, ChevronDown, Mail, Phone, Search } from "lucide-react";
import { Badge, Card, buttonClass, cx, inputClass } from "@/components/ui";

export interface MemberView {
  id: string;
  name: string;
  studentId: string;
  email: string;
  phone: string | null;
  phoneRaw: string | null;
  department: string;
  year: number;
  admin: boolean;
  online: boolean;
  today: boolean;
  seen: string;
  seenAt: string;
  signedIn: string;
  joined: string;
  itemsOut: number;
  overdue: number;
  pending: number;
  totalRequests: number;
}

const FILTERS = [
  { key: "all", label: "Everyone", test: () => true },
  { key: "online", label: "Online now", test: (m: MemberView) => m.online },
  { key: "today", label: "Active today", test: (m: MemberView) => m.today },
  { key: "borrowing", label: "Borrowing now", test: (m: MemberView) => m.itemsOut > 0 },
  { key: "overdue", label: "Overdue", test: (m: MemberView) => m.overdue > 0 },
  { key: "admins", label: "Admins", test: (m: MemberView) => m.admin },
] as const;
type FilterKey = (typeof FILTERS)[number]["key"];

const initials = (name: string) =>
  name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

function Avatar({ m, size = "md" }: { m: MemberView; size?: "sm" | "md" }) {
  return (
    <span className={cx("relative grid shrink-0 place-items-center rounded-full font-bold", size === "md" ? "size-10 text-sm" : "size-8 text-xs", m.admin ? "bg-hero text-white" : "bg-brand-100 text-brand-800")} aria-hidden>
      {initials(m.name)}
      {m.online && <span className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full bg-ok ring-2 ring-card" />}
    </span>
  );
}

export function MemberList({ members, meId }: { members: MemberView[]; meId: string }) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterKey>("all");
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  // Live: refresh who's online every 30 s while this tab is visible.
  useEffect(() => {
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, 30_000);
    return () => clearInterval(timer);
  }, [router]);

  const counts = useMemo(
    () => Object.fromEntries(FILTERS.map((f) => [f.key, members.filter(f.test).length])) as Record<FilterKey, number>,
    [members],
  );
  const onlineNow = members.filter((m) => m.online);
  const q = query.trim().toLowerCase();
  const test = FILTERS.find((f) => f.key === filter)!.test;
  const shown = members.filter(
    (m) => test(m) && (!q || [m.name, m.studentId, m.department, m.email, m.phone ?? ""].some((v) => v.toLowerCase().includes(q))),
  );

  return (
    <div className="flex flex-col gap-4">
      <Card className="enter-up p-5">
        <div className="flex items-center gap-2">
          <span className={cx("size-2.5 rounded-full", onlineNow.length ? "blip bg-ok" : "bg-slate-300")} aria-hidden />
          <h2 className="font-semibold text-ink">
            {onlineNow.length ? `${onlineNow.length} online now` : "Nobody else is online right now"}
          </h2>
          <span className="ml-auto text-xs text-muted">{counts.today} active today</span>
        </div>
        {onlineNow.length > 0 && (
          <ul className="mt-4 flex flex-wrap gap-2">
            {onlineNow.map((m, i) => (
              <li key={m.id} className="enter-up" style={{ animationDelay: `${Math.min(i, 10) * 60}ms` }}>
                <button
                  type="button"
                  onClick={() => {
                    setFilter("all");
                    setQuery("");
                    setOpen(m.id);
                    setTimeout(() => document.getElementById(`member-${m.id}`)?.scrollIntoView({ behavior: "smooth", block: "center" }), 60);
                  }}
                  className="press flex items-center gap-2 rounded-full bg-surface py-1 pl-1 pr-3 text-sm ring-1 ring-line hover:ring-brand-300"
                >
                  <Avatar m={m} size="sm" />
                  <span className="font-medium text-ink">{m.id === meId ? "You" : m.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <div className="flex flex-col gap-3 2xl:flex-row 2xl:items-center">
        <nav aria-label="Filter members" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 2xl:flex-1">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              aria-pressed={filter === f.key}
              className={cx(
                "press inline-flex min-h-9 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-sm font-semibold ring-1 ring-inset transition-colors",
                filter === f.key ? "bg-brand-600 text-white ring-brand-600" : "bg-card text-muted ring-line hover:text-ink",
              )}
            >
              {f.label}
              <span className={cx("tabular-nums", filter === f.key ? "text-white/80" : f.key === "overdue" && counts.overdue ? "text-bad" : "text-muted")}>
                {counts[f.key]}
              </span>
            </button>
          ))}
        </nav>
        <label className="relative 2xl:w-72">
          <span className="sr-only">Search members</span>
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, ID, department…"
            className={cx(inputClass, "pl-9")}
          />
        </label>
      </div>

      <Card className="overflow-hidden">
        {shown.length === 0 ? (
          <p className="px-5 py-10 text-center text-sm text-muted">Nobody matches.</p>
        ) : (
          <ul className="divide-y divide-line">
            {shown.map((m, i) => {
              const isOpen = open === m.id;
              return (
                <li key={m.id} id={`member-${m.id}`} className="enter-up" style={{ animationDelay: `${Math.min(i, 12) * 40}ms` }}>
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : m.id)}
                    aria-expanded={isOpen}
                    aria-controls={`member-panel-${m.id}`}
                    className="flex w-full items-center gap-3 px-5 py-3.5 text-left transition-colors hover:bg-brand-50/70"
                  >
                    <Avatar m={m} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className="truncate font-semibold text-ink">{m.name}</span>
                        {m.id === meId && <Badge tone="gray">You</Badge>}
                        {m.admin && <Badge>Admin</Badge>}
                      </span>
                      <span className="block truncate text-sm text-muted">
                        <span className="font-mono">{m.studentId}</span> · {m.department}, year {m.year}
                      </span>
                    </span>
                    <span className="hidden shrink-0 flex-col items-end gap-1 sm:flex">
                      <span className={cx("text-xs", m.online ? "font-semibold text-ok" : "text-muted")}>{m.online ? "Online now" : m.seen}</span>
                      <span className="flex gap-1">
                        {m.overdue > 0 && <Badge tone="red">{m.overdue} overdue</Badge>}
                        {m.itemsOut > 0 && <Badge tone="blue">{m.itemsOut} item{m.itemsOut === 1 ? "" : "s"} out</Badge>}
                        {m.pending > 0 && <Badge tone="amber">{m.pending} pending</Badge>}
                      </span>
                    </span>
                    <ChevronDown className={cx("size-4 shrink-0 text-muted transition-transform duration-200", isOpen && "rotate-180")} aria-hidden />
                  </button>
                  <div
                    id={`member-panel-${m.id}`}
                    inert={!isOpen}
                    className={cx("grid transition-[grid-template-rows] duration-300 ease-out", isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]")}
                  >
                    <div className="overflow-hidden">
                      <div className={cx("flex flex-col gap-4 px-5 pb-5 transition-opacity duration-300 sm:pl-[4.25rem]", isOpen ? "opacity-100" : "opacity-0")}>
                        <dl className="grid grid-cols-1 gap-x-6 gap-y-2.5 rounded-xl bg-surface p-4 sm:grid-cols-[minmax(8rem,auto)_1fr]">
                          {(
                            [
                              ["Status", m.online ? "Online now" : m.seen],
                              ["Last active", m.seenAt],
                              ["Last signed in", m.signedIn],
                              ["Email", m.email],
                              ["Phone", m.phone ?? "Not added"],
                              ["Borrowing now", m.itemsOut ? `${m.itemsOut} item${m.itemsOut === 1 ? "" : "s"}${m.overdue ? ` · ${m.overdue} request${m.overdue === 1 ? "" : "s"} overdue` : ""}` : "Nothing"],
                              ["Requests", `${m.totalRequests} in total${m.pending ? ` · ${m.pending} waiting for approval` : ""}`],
                              ["Member since", m.joined],
                            ] as const
                          ).map(([k, v]) => (
                            <div key={k} className="contents">
                              <dt className="text-sm text-muted">{k}</dt>
                              <dd className={cx("text-sm font-semibold [overflow-wrap:anywhere]", k === "Borrowing now" && m.overdue ? "text-bad" : "text-ink")}>{v}</dd>
                            </div>
                          ))}
                        </dl>
                        <div className="flex flex-wrap gap-2">
                          <Link href={`/requests?member=${m.id}`} className={buttonClass("primary")}>
                            Their requests <ArrowRight className="size-4" aria-hidden />
                          </Link>
                          <a href={`mailto:${m.email}`} className={buttonClass("secondary")}>
                            <Mail className="size-4" aria-hidden /> Email
                          </a>
                          {m.phoneRaw && (
                            <a href={`tel:${m.phoneRaw}`} className={buttonClass("secondary")}>
                              <Phone className="size-4" aria-hidden /> Call
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
