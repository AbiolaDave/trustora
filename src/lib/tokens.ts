import { createHash, randomBytes } from "node:crypto";
import { AuthToken } from "../models/misc";
import type { Types } from "mongoose";

const hash = (raw: string) => createHash("sha256").update(raw).digest("hex");

export async function createToken(user: Types.ObjectId, purpose: "verify_email" | "reset_password", ttlMinutes: number) {
  const raw = randomBytes(32).toString("hex");
  await AuthToken.deleteMany({ user, purpose });
  await AuthToken.create({ user, purpose, tokenHash: hash(raw), expiresAt: new Date(Date.now() + ttlMinutes * 60_000) });
  return raw;
}
/** Single use: the token is deleted as soon as it is consumed. */
export async function consumeToken(raw: string, purpose: "verify_email" | "reset_password") {
  if (!/^[a-f0-9]{64}$/.test(raw)) return null;
  const t = await AuthToken.findOneAndDelete({ tokenHash: hash(raw), purpose, expiresAt: { $gt: new Date() } });
  return t ? t.user : null;
}
