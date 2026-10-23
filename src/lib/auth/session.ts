import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { env, requireEnv } from "../env";

export type Role = "customer" | "artisan" | "admin";
export interface SessionPayload { sub: string; role: Role }

export const SESSION_COOKIE = "kasuwa_session";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 14;

export const cookieOptions = {
  httpOnly: true,
  secure: env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};

const key = () => new TextEncoder().encode(requireEnv("AUTH_SECRET", "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\""));

export const hashPassword = (plain: string) => bcrypt.hash(plain, 12);
export const verifyPassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);

export async function signSession(p: SessionPayload): Promise<string> {
  return new SignJWT({ role: p.role }).setProtectedHeader({ alg: "HS256" }).setSubject(p.sub).setIssuedAt().setExpirationTime(`${MAX_AGE_SECONDS}s`).sign(key());
}

export async function readSession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, key(), { algorithms: ["HS256"] });
    const role = payload.role;
    if (typeof payload.sub !== "string" || (role !== "customer" && role !== "artisan" && role !== "admin")) return null;
    return { sub: payload.sub, role };
  } catch {
    return null; // expired, tampered, or malformed: treat as logged out
  }
}

/** Throws unless the session has one of the allowed roles. The role in the cookie is only a hint: re-load the user for sensitive writes. */
export function assertRole(s: SessionPayload | null, allowed: Role[]): SessionPayload {
  if (!s) throw new AuthError(401, "Please log in to continue.");
  if (!allowed.includes(s.role)) throw new AuthError(403, "You don't have access to this.");
  return s;
}

export class AuthError extends Error {
  constructor(public status: 401 | 403, message: string) {
    super(message);
  }
}

/** Login throttling: lock after 5 failures for 15 minutes. */
export const LOGIN_MAX_FAILURES = 5;
export const LOGIN_LOCK_MINUTES = 15;
export const isLocked = (lockedUntil?: Date | null, now = new Date()) => !!lockedUntil && lockedUntil.getTime() > now.getTime();
