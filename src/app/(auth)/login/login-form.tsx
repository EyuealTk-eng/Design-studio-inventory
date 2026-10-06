"use client";

import { useActionState } from "react";
import { login, type FormState } from "../actions";
import { Alert, Field, Input } from "@/components/ui";
import { SubmitButton } from "@/components/submit-button";

export function LoginForm({ next }: { next: string }) {
  const [state, action] = useActionState<FormState, FormData>(login, {});
  return (
    <form action={action} className="flex flex-col gap-5">
      {state.error && <Alert>{state.error}</Alert>}
      <input type="hidden" name="next" value={next} />
      <Field label="Student ID" htmlFor="student_id">
        <Input id="student_id" name="student_id" defaultValue={state.values?.student_id} autoComplete="username" required autoFocus />
      </Field>
      <Field label="Password" htmlFor="password">
        <Input id="password" name="password" type="password" autoComplete="current-password" required />
      </Field>
      <SubmitButton pendingText="Signing in…" className="mt-2 w-full">
        Sign in
      </SubmitButton>
    </form>
  );
}
