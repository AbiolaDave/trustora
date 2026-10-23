import Link from "next/link";
import type { Metadata } from "next";
import { AuthCard } from "@/components/auth-card";
import { Field, Flash } from "@/components/ui";
import { registerAction } from "@/server/actions/auth";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Create an account" };

export default async function Register({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const artisan = first(sp.role) === "artisan";
  return (
    <AuthCard title={artisan ? "Join as an artisan" : "Create your account"} intro={artisan ? "Set up your profile, add your services and start getting booking requests." : "Book trusted artisans and track every job in one place."}>
      <Flash error={first(sp.error)} />
      <div className="mb-4 grid grid-cols-2 gap-2" role="tablist" aria-label="Account type">
        <Link href="/register?role=customer" className={`btn btn-sm ${!artisan ? "btn-primary" : "btn-ghost"}`}>I need a service</Link>
        <Link href="/register?role=artisan" className={`btn btn-sm ${artisan ? "btn-primary" : "btn-ghost"}`}>I'm an artisan</Link>
      </div>
      <form action={registerAction} className="space-y-4">
        <input type="hidden" name="role" value={artisan ? "artisan" : "customer"} />
        <Field label="Full name" name="name" required autoComplete="name" />
        <Field label="Email" name="email" type="email" required autoComplete="email" />
        <Field label="Phone number" name="phone" type="tel" required autoComplete="tel" placeholder="0803 123 4567" hint="Used for booking updates." />
        <Field label="Password" name="password" type="password" required minLength={8} autoComplete="new-password" hint="At least 8 characters, with some letters." />
        <button className="btn btn-primary w-full">Create account</button>
        <p className="hint">By signing up you agree to our <Link href="/legal/terms" className="underline">Terms</Link> and <Link href="/legal/privacy" className="underline">Privacy policy</Link>.</p>
      </form>
      <p className="mt-4 text-sm text-ink-500">Already have an account? <Link href="/login" className="underline">Log in</Link></p>
    </AuthCard>
  );
}
