import type { Metadata } from "next";
import { AuthCard } from "../../components/auth-card";
import { Field, Flash } from "../../components/ui";
import { resetPasswordAction } from "../../server/actions/auth";
import { first } from "../../lib/validation";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function Reset({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const token = first(sp.token) ?? "";
  return (
    <AuthCard title="Choose a new password">
      <Flash error={first(sp.error)} />
      <form action={resetPasswordAction} className="space-y-4">
        <input type="hidden" name="token" value={token} />
        <Field label="New password" name="password" type="password" required minLength={8} autoComplete="new-password" hint="At least 8 characters, with some letters." />
        <button className="btn btn-primary w-full">Update password</button>
      </form>
    </AuthCard>
  );
}
