"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { animate, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";

const tones = {
  blue: "bg-brand-50 text-brand-600",
  red: "bg-bad-bg text-bad",
  amber: "bg-warn-bg text-warn",
  green: "bg-ok-bg text-ok",
};

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "blue",
  href,
  index = 0,
}: {
  label: string;
  value: number;
  hint?: string;
  /** A rendered icon element, e.g. <Boxes /> (components can't cross the server boundary). */
  icon: ReactNode;
  tone?: keyof typeof tones;
  href?: string;
  index?: number;
}) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(0);

  useEffect(() => {
    if (reduce) return;
    const controls = animate(0, value, {
      duration: 0.8,
      delay: index * 0.06,
      ease: [0.22, 1, 0.36, 1],
      onUpdate: (v) => setShown(Math.round(v)),
    });
    return () => controls.stop();
  }, [value, reduce, index]);

  const body = (
    <motion.div
      initial={reduce ? false : { opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.06, ease: [0.22, 1, 0.36, 1] }}
      className={cx(
        "flex h-full items-start gap-4 rounded-2xl border border-line bg-white p-5 shadow-card",
        href && "transition-colors hover:border-brand-300",
      )}
    >
      <span className={cx("grid size-11 shrink-0 place-items-center rounded-xl [&_svg]:size-5", tones[tone])}>
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-muted">{label}</p>
        <p className="text-3xl font-bold tabular-nums tracking-tight text-ink" aria-label={String(value)}>
          {reduce ? value : shown}
        </p>
        {hint && <p className="mt-0.5 truncate text-xs text-muted">{hint}</p>}
      </div>
    </motion.div>
  );

  return href ? (
    <Link href={href} className="block rounded-2xl">
      {body}
    </Link>
  ) : (
    body
  );
}
