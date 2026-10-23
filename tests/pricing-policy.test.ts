import { describe, expect, it } from "vitest";
import { computeBreakdown } from "@/domain/pricing";
import { refundForCancellation } from "@/domain/policy";

const off = { commissionBps: 0, customerFeeBps: 0, customerFeeFlatKobo: 0, customerFeeCapKobo: null };

describe("pricing", () => {
  it("charges nothing extra by default", () => {
    const b = computeBreakdown(1_500_000, 100_000, off);
    expect(b.totalKobo).toBe(1_600_000);
    expect(b.platformRevenueKobo).toBe(0);
    expect(b.artisanDueKobo).toBe(1_600_000);
  });

  it("applies commission to the service charge only, and keeps revenue separate from artisan money", () => {
    const b = computeBreakdown(1_000_000, 200_000, { ...off, commissionBps: 1000, customerFeeBps: 200, customerFeeFlatKobo: 10_000, customerFeeCapKobo: 25_000 });
    expect(b.commissionKobo).toBe(100_000);
    expect(b.customerFeeKobo).toBe(25_000); // 2% = 20,000 + 10,000 flat = 30,000, capped at 25,000
    expect(b.totalKobo).toBe(1_225_000);
    expect(b.artisanDueKobo).toBe(1_100_000);
    expect(b.platformRevenueKobo).toBe(125_000);
    // Everything the customer paid is accounted for exactly once.
    expect(b.artisanDueKobo + b.platformRevenueKobo).toBe(b.totalKobo);
  });

  it("rejects bad inputs", () => {
    expect(() => computeBreakdown(0, 0, off)).toThrow();
    expect(() => computeBreakdown(100.5, 0, off)).toThrow();
    expect(() => computeBreakdown(1000, 0, { ...off, commissionBps: 10001 })).toThrow();
  });
});

describe("refund policy", () => {
  it("tiers by notice for customer cancellations", () => {
    expect(refundForCancellation({ cancelledBy: "customer", paidKobo: 100_000, hoursBeforeStart: 30 }).refundKobo).toBe(100_000);
    expect(refundForCancellation({ cancelledBy: "customer", paidKobo: 100_000, hoursBeforeStart: 10 }).refundKobo).toBe(50_000);
    expect(refundForCancellation({ cancelledBy: "customer", paidKobo: 100_000, hoursBeforeStart: 2 }).refundKobo).toBe(0);
  });
  it("always refunds in full when the artisan or platform cancels", () => {
    expect(refundForCancellation({ cancelledBy: "artisan", paidKobo: 100_000, hoursBeforeStart: 1 }).refundKobo).toBe(100_000);
    expect(refundForCancellation({ cancelledBy: "admin", paidKobo: 100_000, hoursBeforeStart: 0 }).refundKobo).toBe(100_000);
  });
  it("refunds nothing when nothing was paid", () => {
    expect(refundForCancellation({ cancelledBy: "customer", paidKobo: 0, hoursBeforeStart: 48 }).refundKobo).toBe(0);
  });
});
