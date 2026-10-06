"use client";

import { Printer } from "lucide-react";
import { Button, type ButtonVariant } from "@/components/ui";

export function PrintButton({
  label = "Print",
  variant = "secondary",
  className,
}: {
  label?: string;
  variant?: ButtonVariant;
  className?: string;
}) {
  return (
    <Button type="button" variant={variant} className={className} onClick={() => window.print()}>
      <Printer className="size-4" aria-hidden /> {label}
    </Button>
  );
}
