"use client";

import { useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cx } from "@/components/ui";
import { THEME_EVENT as EVENT, THEME_KEY as KEY, type ThemeChoice } from "@/lib/theme";

function read(): ThemeChoice {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function subscribe(onChange: () => void) {
  window.addEventListener(EVENT, onChange);
  window.addEventListener("storage", onChange);
  return () => {
    window.removeEventListener(EVENT, onChange);
    window.removeEventListener("storage", onChange);
  };
}

const OPTIONS: { value: ThemeChoice; label: string; icon: typeof Sun }[] = [
  { value: "light", label: "Light", icon: Sun },
  { value: "system", label: "Same as device", icon: Monitor },
  { value: "dark", label: "Dark", icon: Moon },
];

export function ThemeSwitch() {
  const choice = useSyncExternalStore(subscribe, read, () => "system" as ThemeChoice);

  const pick = (value: ThemeChoice) => {
    try {
      if (value === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, value);
    } catch {}
    window.dispatchEvent(new Event(EVENT));
  };

  return (
    <div role="radiogroup" aria-label="Colour theme" className="grid grid-cols-3 gap-1 rounded-xl bg-surface p-1 ring-1 ring-line">
      {OPTIONS.map(({ value, label, icon: Icon }) => (
        <button
          key={value}
          type="button"
          role="radio"
          aria-checked={choice === value}
          title={label}
          onClick={() => pick(value)}
          className={cx(
            "press grid h-9 place-items-center rounded-lg transition-colors",
            choice === value ? "bg-card text-brand-700 shadow-card" : "text-muted hover:text-ink",
          )}
        >
          <Icon className="size-4" aria-hidden />
          <span className="sr-only">{label}</span>
        </button>
      ))}
    </div>
  );
}
