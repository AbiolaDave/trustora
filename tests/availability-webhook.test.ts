import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { bucketsFor, fitsWorkingHours, openSlots } from "@/domain/availability";
import { checkChargeMatches, isValidPaystackSignature } from "@/domain/webhook";

// Monday 2030-01-07, 09:00 Lagos time = 08:00 UTC
const monday9 = new Date("2030-01-07T08:00:00Z");
const weekdays = [1, 2, 3, 4, 5].map((d) => ({ dayOfWeek: d, startMinute: 8 * 60, endMinute: 17 * 60 }));

describe("availability", () => {
  it("a 90 minute job covers 3 buckets", () => {
    expect(bucketsFor(monday9, 90)).toHaveLength(3);
  });
  it("overlapping jobs share a bucket (so the unique index blocks them)", () => {
    const a = bucketsFor(monday9, 120);
    const b = bucketsFor(new Date(monday9.getTime() + 60 * 60_000), 60);
    expect(a.some((x) => b.includes(x))).toBe(true);
    const c = bucketsFor(new Date(monday9.getTime() + 120 * 60_000), 60); // starts exactly when A ends
    expect(a.some((x) => c.includes(x))).toBe(false);
  });
  it("respects working hours in Lagos time and blackout dates", () => {
    expect(fitsWorkingHours(monday9, 60, weekdays)).toBe(true);
    expect(fitsWorkingHours(new Date("2030-01-07T15:30:00Z"), 120, weekdays)).toBe(false); // 16:30 + 2h runs past 17:00
    expect(fitsWorkingHours(new Date("2030-01-06T08:00:00Z"), 60, weekdays)).toBe(false); // Sunday
    expect(fitsWorkingHours(monday9, 60, weekdays, ["2030-01-07"])).toBe(false);
  });
  it("openSlots hides taken buckets and past times", () => {
    const taken = new Set(bucketsFor(monday9, 60));
    const slots = openSlots({ ymd: "2030-01-07", durationMinutes: 60, windows: weekdays, takenBuckets: taken, now: new Date("2030-01-01T00:00:00Z") });
    expect(slots.map((s) => s.toISOString())).not.toContain(monday9.toISOString());
    expect(slots).toHaveLength(8); // 08:00-16:00 starts, minus 09:00
    const none = openSlots({ ymd: "2030-01-07", durationMinutes: 60, windows: weekdays, takenBuckets: new Set(), now: new Date("2030-01-07T12:00:00Z") });
    expect(none.every((s) => s.getTime() >= Date.parse("2030-01-07T14:00:00Z"))).toBe(true); // 2h lead time
  });
});

describe("paystack webhook safety", () => {
  const secret = "sk_test_unit_test_only";
  const body = JSON.stringify({ event: "charge.success", data: { reference: "KSW-1" } });
  const sig = createHmac("sha512", secret).update(body).digest("hex");

  it("accepts a correct signature and rejects wrong, missing or tampered ones", () => {
    expect(isValidPaystackSignature(body, sig, secret)).toBe(true);
    expect(isValidPaystackSignature(body, null, secret)).toBe(false);
    expect(isValidPaystackSignature(body, "abc", secret)).toBe(false);
    expect(isValidPaystackSignature(body + " ", sig, secret)).toBe(false);
    expect(isValidPaystackSignature(body, sig, "other")).toBe(false);
  });

  const expected = { reference: "KSW-1", amountKobo: 500_000, currency: "NGN" as const };
  it("only accepts a charge matching our own records", () => {
    expect(checkChargeMatches({ status: "success", reference: "KSW-1", amount: 500_000, currency: "NGN" }, expected).ok).toBe(true);
    expect(checkChargeMatches({ status: "success", reference: "KSW-1", amount: 100, currency: "NGN" }, expected).ok).toBe(false); // underpaid
    expect(checkChargeMatches({ status: "success", reference: "KSW-1", amount: 500_000, currency: "USD" }, expected).ok).toBe(false);
    expect(checkChargeMatches({ status: "failed", reference: "KSW-1", amount: 500_000, currency: "NGN" }, expected).ok).toBe(false);
    expect(checkChargeMatches({ status: "success", reference: "KSW-2", amount: 500_000, currency: "NGN" }, expected).ok).toBe(false);
  });
});
