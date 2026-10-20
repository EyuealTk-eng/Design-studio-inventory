"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { animate, motion, useReducedMotion } from "motion/react";
import type { ReactNode } from "react";
import { cx } from "@/components/ui";

const tones = {
  blue: "text-brand-600",
  red: "text-bad",
  amber: "text-warn",
  green: "text-ok",
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
        "flex h-full flex-col rounded-2xl border border-line bg-white p-3.5 sm:p-5",
        href && "lift hover:border-brand-300",
      )}
    >
      <p className="flex items-start gap-1.5 text-xs font-medium leading-tight text-muted sm:items-center sm:gap-2 sm:text-sm">
        <span className={cx("shrink-0 [&_svg]:size-4", tones[tone])}>{icon}</span>
        {label}
      </p>
      <p className="mt-2 text-3xl font-bold tabular-nums tracking-tight text-ink sm:mt-3 sm:text-4xl" aria-label={String(value)}>
        {reduce ? value : shown}
      </p>
      {hint && <p className="mt-1 hidden truncate text-xs text-muted sm:block">{hint}</p>}
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
