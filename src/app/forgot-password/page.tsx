import type { Metadata } from "next";
import { AuthCard } from "../../components/auth-card";
import { Field, Flash } from "../../components/ui";
import { forgotPasswordAction } from "../../server/actions/auth";
import { first } from "../../lib/validation";

export const metadata: Metadata = { title: "Reset your password" };

export default async function Forgot({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return (
    <AuthCard title="Reset your password" intro="Enter your email and we'll send you a link to choose a new password.">
      <Flash ok={first(sp.ok)} error={first(sp.error)} />
      <form action={forgotPasswordAction} className="space-y-4">
        <Field label="Email" name="email" type="email" required autoComplete="email" />
        <button className="btn btn-primary w-full">Send reset link</button>
      </form>
    </AuthCard>
  );
}
