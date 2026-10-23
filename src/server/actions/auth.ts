"use server";
import { redirect } from "next/navigation";
import { connectDb } from "../../lib/db";
import { env } from "../../lib/env";
import { fail, done } from "../../lib/flash";
import { hashPassword, verifyPassword, isLocked, LOGIN_LOCK_MINUTES, LOGIN_MAX_FAILURES } from "../../lib/auth/session";
import { endSession, requireUser, startSession } from "../../lib/auth/server";
import { sendEmail } from "../../lib/email";
import { createToken, consumeToken } from "../../lib/tokens";
import { loginSchema, password as passwordRule, registerSchema, slugify, email as emailRule } from "../../lib/validation";
import { User } from "../../models/user";
import { ArtisanProfile } from "../../models/artisan-profile";
import { randomBytes } from "node:crypto";

const str = (f: FormData, k: string) => (f.get(k) ?? "").toString();
const firstIssue = (e: { issues: { message: string }[] }) => e.issues[0]?.message ?? "Please check the form.";

async function sendVerification(user: { _id: any; email: string }) {
  const raw = await createToken(user._id, "verify_email", 60 * 24);
  await sendEmail(user.email, `Verify your email for ${env.APP_NAME}`, `Confirm your email address:\n${env.APP_URL}/verify-email?token=${raw}\n\nThis link works for 24 hours.`);
}

export async function registerAction(form: FormData) {
  const parsed = registerSchema.safeParse({ name: str(form, "name"), email: str(form, "email"), password: str(form, "password"), phone: str(form, "phone"), role: str(form, "role") });
  const back = `/register?role=${str(form, "role") === "artisan" ? "artisan" : "customer"}`;
  if (!parsed.success) return fail(back, firstIssue(parsed.error));
  await connectDb();
  if (await User.exists({ email: parsed.data.email })) return fail(back, "An account with this email already exists. Try logging in.");
  const user = await User.create({ name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone, passwordHash: await hashPassword(parsed.data.password), role: parsed.data.role });
  if (parsed.data.role === "artisan") {
    await ArtisanProfile.create({ user: user._id, displayName: parsed.data.name, slug: `${slugify(parsed.data.name)}-${randomBytes(3).toString("hex")}` });
  }
  await sendVerification(user).catch((e) => console.error("[verify email]", e.message));
  await startSession(user);
  redirect(parsed.data.role === "artisan" ? "/artisan/profile?ok=Welcome! Complete your profile to start getting bookings." : "/dashboard?ok=Welcome! Check your email to verify your account.");
}

export async function loginAction(form: FormData) {
  const next = str(form, "next");
  const parsed = loginSchema.safeParse({ email: str(form, "email"), password: str(form, "password") });
  if (!parsed.success) return fail("/login", "Enter your email and password.");
  await connectDb();
  const user = await User.findOne({ email: parsed.data.email }).select("+passwordHash");
  const generic = "Email or password is incorrect.";
  if (!user) { await hashPassword(parsed.data.password); return fail("/login", generic); } // equalise timing
  if (isLocked(user.lockedUntil)) return fail("/login", `Too many attempts. Try again in ${LOGIN_LOCK_MINUTES} minutes or reset your password.`);
  if (user.status !== "active") return fail("/login", "This account is suspended. Contact support.");
  if (!(await verifyPassword(parsed.data.password, user.passwordHash))) {
    const count = (user.failedLoginCount ?? 0) + 1;
    await User.updateOne({ _id: user._id }, count >= LOGIN_MAX_FAILURES ? { $set: { failedLoginCount: 0, lockedUntil: new Date(Date.now() + LOGIN_LOCK_MINUTES * 60_000) } } : { $set: { failedLoginCount: count } });
    return fail("/login", generic);
  }
  await User.updateOne({ _id: user._id }, { $set: { failedLoginCount: 0 }, $unset: { lockedUntil: 1 } });
  await startSession(user);
  const safeNext = next.startsWith("/") && !next.startsWith("//") ? next : "";
  redirect(safeNext || (user.role === "admin" ? "/admin" : user.role === "artisan" ? "/artisan" : "/dashboard"));
}

export async function logoutAction() {
  await endSession();
  redirect("/?ok=You have been logged out.");
}

export async function resendVerificationAction() {
  const user = await requireUser();
  if (user.emailVerifiedAt) return done("/dashboard", "Your email is already verified.");
  await sendVerification(user);
  return done(user.role === "artisan" ? "/artisan" : "/dashboard", "Verification email sent. Check your inbox.");
}

export async function forgotPasswordAction(form: FormData) {
  const parsed = emailRule.safeParse(str(form, "email"));
  await connectDb();
  if (parsed.success) {
    const user = await User.findOne({ email: parsed.data });
    if (user && user.status === "active") {
      const raw = await createToken(user._id, "reset_password", 60);
      await sendEmail(user.email, `Reset your ${env.APP_NAME} password`, `Choose a new password:\n${env.APP_URL}/reset-password?token=${raw}\n\nThis link works for 1 hour. If you didn't ask for this, ignore this email.`).catch(() => {});
    }
  }
  return done("/forgot-password", "If that email has an account, a reset link is on its way."); // same answer either way
}

export async function resetPasswordAction(form: FormData) {
  const token = str(form, "token");
  const pw = passwordRule.safeParse(str(form, "password"));
  if (!pw.success) return fail(`/reset-password?token=${token}`, firstIssue(pw.error));
  await connectDb();
  const userId = await consumeToken(token, "reset_password");
  if (!userId) return fail("/forgot-password", "That reset link has expired. Request a new one.");
  await User.updateOne({ _id: userId }, { $set: { passwordHash: await hashPassword(pw.data), failedLoginCount: 0 }, $unset: { lockedUntil: 1 } });
  return done("/login", "Password updated. Log in with your new password.");
}
