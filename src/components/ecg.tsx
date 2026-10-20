import { cx } from "@/components/ui";

/** One heartbeat (P wave, QRS spike, T wave) across 120 units, starting and ending on the baseline. */
const BEAT = "h18 l6 -6 l6 6 h8 l4 6 l6 -42 l6 50 l4 -14 h10 q8 -14 16 0 h18";

/**
 * A live heartbeat trace that draws itself across the space — the studio's signature motion.
 * Pure SVG + CSS (no JavaScript), so it costs almost nothing to run.
 */
export function Ecg({ beats = 4, className, strokeWidth = 3 }: { beats?: number; className?: string; strokeWidth?: number }) {
  const d = `M0 60 ${Array.from({ length: beats }, () => BEAT).join(" ")}`;
  return (
    <svg viewBox={`0 0 ${beats * 120} 100`} preserveAspectRatio="none" className={cx("overflow-visible", className)} aria-hidden>
      <path d={d} fill="none" stroke="currentColor" strokeOpacity={0.18} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <path
        d={d}
        pathLength={1000}
        className="ecg-trace"
        style={{ ["--ecg-len" as string]: 1000 }}
        fill="none"
        stroke="currentColor"
        strokeWidth={strokeWidth}
        strokeLinejoin="round"
        strokeLinecap="round"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}
