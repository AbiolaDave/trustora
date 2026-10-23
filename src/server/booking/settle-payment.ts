import { Types } from "mongoose";
import { transition } from "../../domain/booking-state";
import { checkChargeMatches, type ProviderCharge } from "../../domain/webhook";
import { Booking } from "../../models/booking";
import { Payment } from "../../models/payment";
import { makeHoldPermanent } from "./reserve";

export type SettleResult =
  | { outcome: "confirmed" }
  | { outcome: "already_processed" }
  | { outcome: "rejected"; reason: string }
  | { outcome: "paid_but_booking_unavailable" }; // customer paid after the hold lapsed: must be refunded

/**
 * The ONLY place a payment turns into a confirmed booking. Called by the webhook handler and the
 * return-URL verifier, always with data fetched from / signed by the provider, never from the browser.
 * Safe to call many times for the same reference (duplicate webhooks, double clicks, retries).
 */
export async function settleVerifiedCharge(charge: ProviderCharge, eventId?: string): Promise<SettleResult> {
  const payment = await Payment.findOne({ reference: charge.reference });
  if (!payment) return { outcome: "rejected", reason: "Unknown payment reference." };
  if (payment.status === "success") return { outcome: "already_processed" };

  const check = checkChargeMatches(charge, { reference: payment.reference, amountKobo: payment.amountKobo, currency: "NGN" });
  if (!check.ok) return { outcome: "rejected", reason: check.reason };

  // Atomic claim: exactly one caller flips initialized -> success.
  const claimed = await Payment.findOneAndUpdate(
    { _id: payment._id, status: { $ne: "success" } },
    { $set: { status: "success", paidAt: new Date() }, ...(eventId ? { $addToSet: { processedEventIds: eventId } } : {}) },
    { new: true },
  );
  if (!claimed) return { outcome: "already_processed" };

  const booking = await Booking.findById(claimed.booking);
  if (!booking) return { outcome: "rejected", reason: "Booking not found." };

  let next;
  try {
    next = transition(booking.status, "payment_verified", "system", { pricingModel: booking.pricingModel });
  } catch {
    // Money arrived but the booking is expired/cancelled. Queue a refund instead of silently keeping it.
    await Payment.updateOne({ _id: claimed._id }, { $push: { refunds: { amountKobo: claimed.amountKobo, status: "pending", reason: "Booking no longer awaiting payment", at: new Date() } } });
    return { outcome: "paid_but_booking_unavailable" };
  }

  const updated = await Booking.findOneAndUpdate(
    { _id: booking._id, status: "awaiting_payment" },
    {
      $set: { status: next, paymentStatus: "paid" },
      $unset: { expiresAt: 1 },
      $push: { statusHistory: { from: "awaiting_payment", to: next, event: "payment_verified", actor: "system", at: new Date() } },
    },
  );
  if (!updated) return { outcome: "paid_but_booking_unavailable" };
  await makeHoldPermanent(booking._id as Types.ObjectId);
  return { outcome: "confirmed" };
}
