"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import {
  Bell,
  CalendarCheck,
  ClipboardList,
  LayoutDashboard,
  LogOut,
  Menu,
  PackagePlus,
  Settings,
  Boxes,
  UserCheck,
  UserCircle,
  X,
  type LucideIcon,
} from "lucide-react";
import { logout } from "@/app/(auth)/actions";
import { Logo, cx } from "@/components/ui";
import type { Role } from "@/lib/types";

interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  count?: number;
}

export function Sidebar({
  profile,
  counts,
}: {
  profile: { full_name: string; student_id: string; role: Role };
  counts: { notifications: number; requests: number; registrations: number };
}) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const reduce = useReducedMotion();
  const isAdmin = profile.role === "admin";

  const nav: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/inventory", label: "Inventory", icon: Boxes },
    ...(isAdmin
      ? [
          { href: "/requests", label: "Requests", icon: ClipboardList, count: counts.requests },
          { href: "/registrations", label: "Registrations", icon: UserCheck, count: counts.registrations },
          { href: "/checkin", label: "Monthly check-in", icon: CalendarCheck },
          { href: "/settings", label: "Settings", icon: Settings },
        ]
      : [
          { href: "/requests/new", label: "Borrow items", icon: PackagePlus },
          { href: "/requests", label: "My requests", icon: ClipboardList },
        ]),
    { href: "/notifications", label: "Notifications", icon: Bell, count: counts.notifications },
    { href: "/account", label: "My account", icon: UserCircle },
  ];

  const isActive = (href: string) =>
    href === "/requests"
      ? pathname === "/requests" || (/^\/requests\/(?!new)/.test(pathname))
      : pathname === href || pathname.startsWith(`${href}/`);

  const panel = (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-3 px-6 py-6">
        <Logo className="size-10 text-brand-600" />
        <div className="leading-tight">
          <p className="font-bold text-ink">Design Studio</p>
          <p className="text-xs font-medium text-muted">Biomedical inventory</p>
        </div>
      </div>
      <nav aria-label="Main" className="flex-1 overflow-y-auto px-3">
        <ul className="flex flex-col gap-1">
          {nav.map(({ href, label, icon: Icon, count }) => {
            const active = isActive(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  onClick={() => setOpen(false)}
                  aria-current={active ? "page" : undefined}
                  className={cx(
                    "relative flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-semibold transition-colors",
                    active ? "text-brand-700" : "text-muted hover:bg-brand-50 hover:text-ink",
                  )}
                >
                  {active && (
                    <motion.span
                      layoutId={reduce ? undefined : "nav-active"}
                      className="absolute inset-0 rounded-xl bg-brand-50 ring-1 ring-brand-100"
                      transition={{ type: "spring", stiffness: 500, damping: 40 }}
                      aria-hidden
                    />
                  )}
                  <Icon className="relative size-5" aria-hidden />
                  <span className="relative flex-1">{label}</span>
                  {!!count && (
                    <span className="relative grid min-w-6 place-items-center rounded-full bg-brand-600 px-1.5 text-xs font-bold text-white">
                      {count > 99 ? "99+" : count}
                      <span className="sr-only"> new</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
      <div className="m-3 rounded-2xl border border-line bg-surface p-3">
        <div className="flex items-center gap-3">
          <div className="grid size-10 shrink-0 place-items-center rounded-full bg-brand-600 text-sm font-bold text-white" aria-hidden>
            {profile.full_name
              .split(/\s+/)
              .slice(0, 2)
              .map((w) => w[0])
              .join("")
              .toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-ink">{profile.full_name}</p>
            <p className="truncate text-xs text-muted">
              {profile.student_id} · {isAdmin ? "Admin" : "Student"}
            </p>
          </div>
          <form action={logout}>
            <button
              type="submit"
              className="grid size-11 place-items-center rounded-xl text-muted hover:bg-white hover:text-bad"
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut className="size-5" aria-hidden />
            </button>
          </form>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-72 border-r border-line bg-white lg:block">
        {panel}
      </aside>

      <header className="no-print sticky top-0 z-30 flex items-center justify-between border-b border-line bg-white/90 px-4 py-2 backdrop-blur lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2 font-bold">
          <Logo className="size-8 text-brand-600" />
          Design Studio
        </Link>
        <div className="flex items-center gap-1">
          <Link href="/notifications" className="relative grid size-11 place-items-center rounded-xl text-muted" aria-label={`Notifications (${counts.notifications} unread)`}>
            <Bell className="size-5" aria-hidden />
            {counts.notifications > 0 && <span className="absolute right-2.5 top-2.5 size-2.5 rounded-full bg-brand-600 ring-2 ring-white" />}
          </Link>
          <button
            type="button"
            onClick={() => setOpen(true)}
            className="grid size-11 place-items-center rounded-xl text-ink"
            aria-label="Open menu"
            aria-expanded={open}
          >
            <Menu className="size-6" aria-hidden />
          </button>
        </div>
      </header>

      <AnimatePresence>
        {open && (
          <div className="fixed inset-0 z-40 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
            <motion.div
              className="absolute inset-0 bg-brand-950/40"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setOpen(false)}
            />
            <motion.div
              className="absolute inset-y-0 left-0 w-[min(20rem,85vw)] bg-white shadow-2xl"
              initial={{ x: reduce ? 0 : "-100%" }}
              animate={{ x: 0 }}
              exit={{ x: reduce ? 0 : "-100%", transition: { duration: 0.18 } }}
              transition={{ type: "spring", stiffness: 420, damping: 40 }}
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="absolute right-3 top-5 grid size-11 place-items-center rounded-xl text-muted"
                aria-label="Close menu"
              >
                <X className="size-5" aria-hidden />
              </button>
              {panel}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
