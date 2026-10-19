"use client";

import { useActionState } from "react";
import Link from "next/link";
import { CheckCircle2 } from "lucide-react";
import { signup, type FormState } from "../actions";
import { Alert, Field, Input, Select, buttonClass } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";
import { PasswordInput } from "@/components/password-input";

export function SignupForm() {
  const [state, action] = useActionState<FormState, FormData>(signup, {});
  const fe = state.fieldErrors ?? {};
  const val = state.values ?? {};

  if (state.success) {
    return (
      <div className="flex flex-col items-center gap-4 rounded-2xl border border-ok/20 bg-ok-bg p-8 text-center">
        <CheckCircle2 className="size-12 text-ok" aria-hidden />
        <p className="font-semibold text-ink">{state.success}</p>
        <Link href="/login" className={buttonClass("secondary")}>
          Go to sign in
        </Link>
      </div>
    );
  }

  return (
    <form action={action} className="flex flex-col gap-4" noValidate>
      {state.error && <Alert>{state.error}</Alert>}
      <p className="text-xs text-muted">
        Fields marked <span className="text-bad">*</span> are required.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="First name" htmlFor="first_name" error={fe.first_name} required>
          <Input id="first_name" name="first_name" defaultValue={val.first_name} autoComplete="given-name" required aria-invalid={!!fe.first_name} />
        </Field>
        <Field label="Last name" htmlFor="last_name" error={fe.last_name} required>
          <Input id="last_name" name="last_name" defaultValue={val.last_name} autoComplete="family-name" required aria-invalid={!!fe.last_name} />
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Student ID" htmlFor="student_id" error={fe.student_id} hint="As on your ID card, e.g. UGR/2154/17" required>
          <Input id="student_id" name="student_id" defaultValue={val.student_id} autoComplete="username" placeholder="UGR/2154/17" required aria-invalid={!!fe.student_id} />
        </Field>
        <Field label="Email" htmlFor="email" error={fe.email} required>
          <Input id="email" name="email" defaultValue={val.email} type="email" autoComplete="email" required aria-invalid={!!fe.email} />
        </Field>
      </div>
      <Field label="Phone number" htmlFor="phone" error={fe.phone} hint="For SMS reminders about your return dates" required>
        <Input id="phone" name="phone" type="tel" inputMode="tel" defaultValue={val.phone} autoComplete="tel" placeholder="0911 234 567" required aria-invalid={!!fe.phone} />
      </Field>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem]">
        <Field label="Department" htmlFor="department" error={fe.department} required>
          <Input id="department" name="department" defaultValue={val.department} placeholder="e.g. Biomedical Engineering" required aria-invalid={!!fe.department} />
        </Field>
        <Field label="Year" htmlFor="year" error={fe.year} required>
          <Select id="year" name="year" key={val.year} defaultValue={val.year ?? ""} required aria-invalid={!!fe.year}>
            <option value="" disabled>
              Select
            </option>
            {[1, 2, 3, 4, 5, 6, 7, 8].map((y) => (
              <option key={y} value={y}>
                Year {y}
              </option>
            ))}
          </Select>
        </Field>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="New password" htmlFor="password" error={fe.password} hint="At least 8 characters" required>
          <PasswordInput id="password" name="password" autoComplete="new-password" required aria-invalid={!!fe.password} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm" error={fe.confirm} required>
          <PasswordInput id="confirm" name="confirm" autoComplete="new-password" required aria-invalid={!!fe.confirm} />
        </Field>
      </div>
      <SubmitButton pendingText="Sending…" className="mt-2 w-full">
        Send registration
      </SubmitButton>
    </form>
  );
}
