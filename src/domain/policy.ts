import type { Actor } from "./booking-state";

/** Cancellation/refund rules live here (and in PlatformSettings) so they can be tested and tuned. */
export interface RefundTier { minHoursBeforeStart: number; refundBps: number }

export const DEFAULT_CUSTOMER_CANCEL_TIERS: RefundTier[] = [
  { minHoursBeforeStart: 24, refundBps: 10000 }, // 24h+ ahead: full refund
  { minHoursBeforeStart: 6, refundBps: 5000 }, // 6-24h: half
  { minHoursBeforeStart: 0, refundBps: 0 }, // under 6h: none
];

export interface RefundDecision { refundKobo: number; reason: string }

export function refundForCancellation(opts: {
  cancelledBy: Actor;
  paidKobo: number; // amount actually verified as paid (0 if unpaid)
  hoursBeforeStart: number;
  tiers?: RefundTier[];
}): RefundDecision {
  const { cancelledBy, paidKobo, hoursBeforeStart } = opts;
  if (paidKobo <= 0) return { refundKobo: 0, reason: "No payment was made." };
  // Artisan, admin and system cancellations are never the customer's fault.
  if (cancelledBy !== "customer") return { refundKobo: paidKobo, reason: "Cancelled by the platform or artisan: full refund." };

  const tiers = [...(opts.tiers ?? DEFAULT_CUSTOMER_CANCEL_TIERS)].sort((a, b) => b.minHoursBeforeStart - a.minHoursBeforeStart);
  const tier = tiers.find((t) => hoursBeforeStart >= t.minHoursBeforeStart) ?? { minHoursBeforeStart: 0, refundBps: 0 };
  return {
    refundKobo: Math.floor((paidKobo * tier.refundBps) / 10000),
    reason: `Customer cancelled ${Math.max(0, Math.floor(hoursBeforeStart))}h before start: ${tier.refundBps / 100}% refund.`,
  };
}

export const POLICY_DEFAULTS = {
  artisanResponseHours: 12, // pending_artisan_response -> expired
  quoteApprovalHours: 48,
  paymentHoldMinutes: 120, // slot hold while awaiting payment
  autoConfirmCompletionHours: 48, // customer silence after artisan finishes
  disputeWindowHours: 72,
} as const;
