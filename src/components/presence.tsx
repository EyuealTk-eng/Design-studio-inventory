"use client";

import { useEffect } from "react";
import { ping } from "@/app/(app)/members/actions";

/** Keeps "online now" accurate while a tab stays open: a tiny ping every 2 minutes, only when visible. */
export function Presence() {
  useEffect(() => {
    const beat = () => {
      if (document.visibilityState === "visible") ping().catch(() => {});
    };
    const timer = setInterval(beat, 120_000);
    document.addEventListener("visibilitychange", beat);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", beat);
    };
  }, []);
  return null;
}
