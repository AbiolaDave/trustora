import { createHmac, timingSafeEqual } from "node:crypto";

/** Paystack signs the RAW request body with HMAC-SHA512 using your secret key. Verify before parsing. */
export function isValidPaystackSignature(rawBody: string, signature: string | null, secret: string): boolean {
  if (!signature || !secret) return false;
  const expected = createHmac("sha512", secret).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(signature, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export interface ProviderCharge { status: string; reference: string; amount: number; currency: string }
export type ChargeCheck = { ok: true } | { ok: false; reason: string };

/** Never trust the browser or a webhook blindly: compare provider data to what OUR database expects. */
export function checkChargeMatches(charge: ProviderCharge, expected: { reference: string; amountKobo: number; currency: "NGN" }): ChargeCheck {
  if (charge.status !== "success") return { ok: false, reason: `Charge status is ${charge.status}.` };
  if (charge.reference !== expected.reference) return { ok: false, reason: "Reference mismatch." };
  if (charge.currency !== expected.currency) return { ok: false, reason: "Currency mismatch." };
  if (charge.amount !== expected.amountKobo) return { ok: false, reason: "Amount mismatch." };
  return { ok: true };
}
