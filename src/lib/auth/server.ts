import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { connectDb } from "../db";
import { User, type UserDoc } from "@/models/user";
import { ArtisanProfile } from "@/models/artisan-profile";
import {
  SESSION_COOKIE,
  cookieOptions,
  readSession,
  signSession,
  type Role,
} from "./session";

export async function getCurrentUser(): Promise<
  (UserDoc & { _id: import("mongoose").Types.ObjectId }) | null
> {
  const jar = await cookies();
  const s = await readSession(jar.get(SESSION_COOKIE)?.value);
  if (!s) return null;
  await connectDb();
  const u = await User.findById(s.sub).lean();
  if (!u || u.status !== "active") return null;
  return u as UserDoc & { _id: import("mongoose").Types.ObjectId }; // role comes from the DATABASE, never the cookie
}

/** Use at the top of every protected page AND every server action. */
export async function requireUser(roles?: Role[]) {
  const u = await getCurrentUser();
  if (!u) redirect("/login");
  if (roles && !roles.includes(u.role as Role))
    redirect(
      u.role === "admin"
        ? "/admin"
        : u.role === "artisan"
          ? "/artisan"
          : "/dashboard",
    );
  return u;
}

export async function requireArtisan() {
  const user = await requireUser(["artisan"]);
  const profile = await ArtisanProfile.findOne({ user: user._id }).lean();
  return { user, profile };
}

export async function startSession(user: { _id: unknown; role: string }) {
  const jar = await cookies();
  jar.set(
    SESSION_COOKIE,
    await signSession({ sub: String(user._id), role: user.role as Role }),
    cookieOptions,
  );
}
export async function endSession() {
  (await cookies()).delete(SESSION_COOKIE);
}
