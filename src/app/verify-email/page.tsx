import Link from "next/link";
import type { Metadata } from "next";
import { connectDb } from "@/lib/db";
import { consumeToken } from "@/lib/tokens";
import { User } from "@/models/user";
import { AuthCard } from "@/components/auth-card";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Verify your email" };
export const dynamic = "force-dynamic";

export default async function VerifyEmail({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const token = first((await searchParams).token) ?? "";
  await connectDb();
  const userId = await consumeToken(token, "verify_email");
  if (userId) await User.updateOne({ _id: userId }, { $set: { emailVerifiedAt: new Date() } });
  return (
    <AuthCard title={userId ? "Email verified" : "This link has expired"}>
      <p className="text-ink-500">{userId ? "Thanks. You can now book services and complete your profile." : "Log in and use the \"resend\" button on your dashboard to get a fresh link."}</p>
      <Link href={userId ? "/dashboard" : "/login"} className="btn btn-primary mt-5">{userId ? "Continue" : "Log in"}</Link>
    </AuthCard>
  );
}
