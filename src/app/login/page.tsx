import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { Field, Flash } from "@/components/ui";
import { loginAction } from "@/server/actions/auth";
import { getCurrentUser } from "@/lib/auth/server";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Log in" };
export const dynamic = "force-dynamic";

export default async function Login({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const user = await getCurrentUser();
  if (user) redirect(user.role === "admin" ? "/admin" : user.role === "artisan" ? "/artisan" : "/dashboard");
  return (
    <AuthCard title="Log in">
      <Flash ok={first(sp.ok)} error={first(sp.error)} />
      <form action={loginAction} className="space-y-4">
        <input type="hidden" name="next" value={first(sp.next) ?? ""} />
        <Field label="Email" name="email" type="email" required autoComplete="email" />
        <Field label="Password" name="password" type="password" required autoComplete="current-password" />
        <button className="btn btn-primary w-full">Log in</button>
      </form>
      <p className="mt-4 text-sm"><Link href="/forgot-password" className="underline">Forgot your password?</Link></p>
      <p className="mt-2 text-sm text-ink-500">New here? <Link href="/register" className="underline">Create an account</Link></p>
    </AuthCard>
  );
}
