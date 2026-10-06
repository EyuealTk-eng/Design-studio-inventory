import type { Metadata } from "next";
import Link from "next/link";
import { SignupForm } from "./signup-form";

export const metadata: Metadata = { title: "Register" };

export default function SignupPage() {
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Register for access</h1>
      <p className="mt-2 text-muted">
        An admin reviews every registration. Once approved, sign in with your student ID.
      </p>
      <div className="mt-8">
        <SignupForm />
      </div>
      <p className="mt-8 text-center text-sm text-muted">
        Already approved?{" "}
        <Link href="/login" className="font-semibold text-brand-700 hover:underline">
          Sign in
        </Link>
      </p>
    </>
  );
}
