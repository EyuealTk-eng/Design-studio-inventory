"use client";

import { useSyncExternalStore } from "react";
import { Moon } from "lucide-react";
import { cx } from "@/components/ui";
import { THEME_EVENT, THEME_KEY } from "@/lib/theme";

// themeScript (in <head>) keeps <html data-theme> current; this just reads it.
function subscribe(onChange: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  window.addEventListener(THEME_EVENT, onChange);
  window.addEventListener("storage", onChange);
  media.addEventListener("change", onChange);
  return () => {
    window.removeEventListener(THEME_EVENT, onChange);
    window.removeEventListener("storage", onChange);
    media.removeEventListener("change", onChange);
  };
}
const isDark = () => document.documentElement.dataset.theme === "dark";
const followsDevice = () => {
  try {
    return !localStorage.getItem(THEME_KEY);
  } catch {
    return true;
  }
};

function save(value: "light" | "dark" | null) {
  try {
    if (value) localStorage.setItem(THEME_KEY, value);
    else localStorage.removeItem(THEME_KEY);
  } catch {}
  window.dispatchEvent(new Event(THEME_EVENT));
}

/** "Appearance" row with a dark-mode toggle, for the account and settings pages. */
export function ThemeSwitch() {
  const dark = useSyncExternalStore(subscribe, isDark, () => false);
  const auto = useSyncExternalStore(subscribe, followsDevice, () => true);

  return (
    <div className="flex items-center gap-4">
      <Moon className="size-5 shrink-0 text-brand-600" aria-hidden />
      <div className="min-w-0 flex-1">
        <p id="dark-mode-label" className="font-semibold text-ink">Dark mode</p>
        <p className="text-sm text-muted">
          {auto ? (
            "Following your device's setting."
          ) : (
            <>
              Saved on this device.{" "}
              <button type="button" onClick={() => save(null)} className="font-semibold text-brand-700 hover:underline">
                Follow my device instead
              </button>
            </>
          )}
        </p>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={dark}
        aria-labelledby="dark-mode-label"
        onClick={() => save(dark ? "light" : "dark")}
        className={cx(
          "relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors duration-200",
          dark ? "bg-brand-600" : "bg-slate-300",
        )}
      >
        <span
          className={cx(
            "inline-block size-5 rounded-full bg-white shadow transition-transform duration-200 ease-out",
            dark ? "translate-x-6" : "translate-x-1",
          )}
          aria-hidden
        />
      </button>
    </div>
  );
}
