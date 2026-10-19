"use client";

import type { ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { Loader2 } from "lucide-react";
import { Button, type ButtonVariant } from "@/components/ui";

/** Submit button that asks for confirmation first (for destructive actions). */
export function ConfirmSubmit({
  children,
  message,
  variant = "danger",
  name,
  value,
}: {
  children: ReactNode;
  message: string;
  variant?: ButtonVariant;
  name?: string;
  value?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <Button
      type="submit"
      variant={variant}
      name={name}
      value={value}
      disabled={pending}
      aria-busy={pending}
      onClick={(e) => {
        if (!window.confirm(message)) e.preventDefault();
      }}
    >
      {pending && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </Button>
  );
}
