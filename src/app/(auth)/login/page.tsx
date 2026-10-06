import type { Metadata } from "next";
import Link from "next/link";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const { next } = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-muted">Sign in with your student ID and password.</p>
      <div className="mt-8">
        <LoginForm next={typeof next === "string" ? next : ""} />
      </div>
      <p className="mt-8 text-center text-sm text-muted">
        New to the studio?{" "}
        <Link href="/signup" className="font-semibold text-brand-700 hover:underline">
          Register for access
        </Link>
      </p>
    </>
  );
}
