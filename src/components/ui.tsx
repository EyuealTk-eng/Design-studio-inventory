import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import type { RequestStatus } from "@/lib/types";

export function cx(...classes: (string | false | null | undefined)[]) {
  return classes.filter(Boolean).join(" ");
}

const buttonBase =
  "inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold transition-colors duration-150 disabled:cursor-not-allowed disabled:opacity-60";
const buttonVariants = {
  primary: "bg-brand-600 text-white shadow-sm hover:bg-brand-700 active:bg-brand-800",
  secondary: "border border-line bg-white text-ink hover:border-brand-300 hover:bg-brand-50",
  danger: "border border-bad/20 bg-bad-bg text-bad hover:bg-bad hover:text-white",
  ghost: "text-brand-700 hover:bg-brand-50",
};
export type ButtonVariant = keyof typeof buttonVariants;

export function buttonClass(variant: ButtonVariant = "primary", extra?: string) {
  return cx(buttonBase, buttonVariants[variant], extra);
}

export function Button({
  variant = "primary",
  className,
  ...props
}: ComponentProps<"button"> & { variant?: ButtonVariant }) {
  return <button className={buttonClass(variant, className)} {...props} />;
}

export function ButtonLink({
  variant = "primary",
  className,
  ...props
}: ComponentProps<typeof Link> & { variant?: ButtonVariant }) {
  return <Link className={buttonClass(variant, className)} {...props} />;
}

export function Card({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      className={cx("rounded-2xl border border-line bg-white shadow-card", className)}
      {...props}
    />
  );
}

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-ink sm:text-3xl">{title}</h1>
        {description && <p className="mt-1 text-muted">{description}</p>}
      </div>
      {actions && <div className="no-print flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

const tones = {
  blue: "bg-brand-50 text-brand-700 ring-brand-200",
  green: "bg-ok-bg text-ok ring-ok/20",
  amber: "bg-warn-bg text-warn ring-warn/20",
  red: "bg-bad-bg text-bad ring-bad/20",
  gray: "bg-slate-100 text-slate-600 ring-slate-200",
};
export type Tone = keyof typeof tones;

export function Badge({ tone = "blue", children }: { tone?: Tone; children: ReactNode }) {
  return (
    <span
      className={cx(
        "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ring-inset",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

const statusTone: Record<RequestStatus, Tone> = {
  pending: "amber",
  approved: "blue",
  rejected: "red",
  returned: "green",
};

export function StatusBadge({ status, overdue }: { status: RequestStatus; overdue?: boolean }) {
  if (overdue) return <Badge tone="red">Overdue</Badge>;
  const label = status === "approved" ? "Borrowed" : status[0].toUpperCase() + status.slice(1);
  return <Badge tone={statusTone[status]}>{label}</Badge>;
}

export function Field({
  label,
  hint,
  error,
  children,
  htmlFor,
}: {
  label: string;
  hint?: string;
  error?: string;
  children: ReactNode;
  htmlFor: string;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p className="text-xs font-medium text-bad" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

export const inputClass =
  "min-h-11 w-full rounded-xl border border-line bg-white px-3.5 text-base text-ink placeholder:text-slate-400 transition-colors hover:border-brand-300 focus:border-brand-500 focus:outline-none focus:ring-4 focus:ring-brand-100 sm:text-sm";

export function Input({ className, ...props }: ComponentProps<"input">) {
  return <input className={cx(inputClass, className)} {...props} />;
}

export function Select({ className, ...props }: ComponentProps<"select">) {
  return <select className={cx(inputClass, "pr-8", className)} {...props} />;
}

export function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return <textarea className={cx(inputClass, "min-h-24 py-2.5", className)} {...props} />;
}

export function Alert({ tone = "red", children }: { tone?: "red" | "green" | "blue"; children: ReactNode }) {
  const styles = {
    red: "border-bad/20 bg-bad-bg text-bad",
    green: "border-ok/20 bg-ok-bg text-ok",
    blue: "border-brand-200 bg-brand-50 text-brand-800",
  };
  return (
    <div role={tone === "red" ? "alert" : "status"} className={cx("rounded-xl border px-4 py-3 text-sm font-medium", styles[tone])}>
      {children}
    </div>
  );
}

export function EmptyState({ icon, title, children }: { icon: ReactNode; title: string; children?: ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 px-6 py-14 text-center">
      <div className="mb-1 grid size-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">{icon}</div>
      <p className="font-semibold text-ink">{title}</p>
      {children && <div className="max-w-sm text-sm text-muted">{children}</div>}
    </div>
  );
}

/** Availability bar: available / total, coloured by stock health. */
export function StockMeter({ available, total, threshold }: { available: number; total: number; threshold: number }) {
  const pct = total === 0 ? 0 : Math.round((available / total) * 100);
  const low = available <= threshold;
  return (
    <div className="flex w-full min-w-20 items-center gap-2 sm:min-w-28" title={`${available} of ${total} available`}>
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-brand-50" aria-hidden>
        <div
          className={cx("h-full rounded-full", available === 0 ? "bg-bad" : low ? "bg-warn" : "bg-brand-500")}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-14 text-right text-sm tabular-nums">
        <span className="font-semibold">{available}</span>
        <span className="text-muted">/{total}</span>
      </span>
    </div>
  );
}

export function Logo({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <rect width="40" height="40" rx="11" fill="currentColor" />
      <path
        d="M7 21h6l3-7 5 14 3-9 2 2h7"
        fill="none"
        stroke="#fff"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
