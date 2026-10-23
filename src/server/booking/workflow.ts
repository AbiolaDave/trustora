import { Types } from "mongoose";
import { transition, type Actor, type BookingEvent } from "../../domain/booking-state";
import { refundForCancellation, POLICY_DEFAULTS } from "../../domain/policy";
import { Booking } from "../../models/booking";
import { Payment } from "../../models/payment";
import { ArtisanProfile } from "../../models/artisan-profile";
import { Payout } from "../../models/misc";
import { SlotReservation } from "../../models/booking";
import { getPaymentProvider } from "../../lib/payments/provider";
import { getSettings } from "../../lib/settings";
import { releaseSlots } from "./reserve";
import { randomBytes } from "node:crypto";

export const newReference = (prefix = "KSW") => `${prefix}-${randomBytes(5).toString("hex").toUpperCase()}`;
export const hoursFromNow = (h: number) => new Date(Date.now() + h * 3_600_000);
export const setSlotHold = (bookingId: Types.ObjectId, until: Date) => SlotReservation.updateMany({ booking: bookingId }, { $set: { holdExpiresAt: until } });

/** The ONLY function that changes Booking.status (besides the payment settler). Validates, then writes atomically. */
export async function moveBooking(id: Types.ObjectId | string, event: BookingEvent, actor: Actor, actorId: Types.ObjectId | null, set: Record<string, unknown> = {}, unset: Record<string, 1> = {}) {
  const b = await Booking.findById(id);
  if (!b) throw new Error("Booking not found.");
  const to = transition(b.status, event, actor, { pricingModel: b.pricingModel });
  const update = { $set: { status: to, ...set }, ...(Object.keys(unset).length ? { $unset: unset } : {}), $push: { statusHistory: { from: b.status, to, event, actor, actorId, at: new Date() } } };
  const updated = await Booking.findOneAndUpdate({ _id: b._id, status: b.status }, update as never, { new: true });
  if (!updated) throw new Error("This booking just changed. Please refresh and try again.");
  return updated;
}

export async function issueRefund(paymentId: Types.ObjectId, amountKobo: number, reason: string) {
  const payment = await Payment.findById(paymentId);
  if (!payment || payment.status !== "success" || amountKobo <= 0) return;
  const already = payment.refunds.reduce((n, r) => (r.status === "failed" ? n : n + (r.amountKobo ?? 0)), 0);
  const amount = Math.min(amountKobo, payment.amountKobo - already);
  if (amount <= 0) return;
  let status: "pending" | "processed" | "failed" = "pending";
  let providerRef: string | undefined;
  try {
    const r = await getPaymentProvider().refund(payment.reference, amount);
    status = r.status; providerRef = r.providerRef;
  } catch (e) {
    status = "failed"; reason = `${reason} (provider error: ${(e as Error).message})`; // an admin can see and retry this
  }
  payment.refunds.push({ amountKobo: amount, providerRef, status, reason, at: new Date() } as never);
  await payment.save();
  if (status !== "failed") {
    const full = already + amount >= payment.amountKobo;
    await Booking.updateOne({ _id: payment.booking }, { $set: { paymentStatus: full ? "refunded" : "partially_refunded" } });
  }
}

export async function cancelBooking(id: Types.ObjectId | string, actor: Actor, actorId: Types.ObjectId | null, reason: string) {
  const before = await Booking.findById(id);
  if (!before) throw new Error("Booking not found.");
  const payment = before.paymentStatus === "paid" ? await Payment.findOne({ booking: before._id, status: "success" }) : null;
  const settings = await getSettings();
  const hours = (before.startsAt.getTime() - Date.now()) / 3_600_000;
  const decision = refundForCancellation({ cancelledBy: actor, paidKobo: payment?.amountKobo ?? 0, hoursBeforeStart: hours, tiers: settings.cancelTiers });
  const b = await moveBooking(id, "cancel", actor, actorId, { cancellation: { by: actor, reason, at: new Date(), refundKobo: decision.refundKobo } }, { expiresAt: 1 });
  await releaseSlots(b._id);
  if (payment && decision.refundKobo > 0) await issueRefund(payment._id, decision.refundKobo, decision.reason);
  return { booking: b, decision };
}

export async function afterCompleted(bookingId: Types.ObjectId) {
  const b = await Booking.findById(bookingId);
  if (!b || !b.pricing?.artisanDueKobo) return;
  await Payout.updateOne(
    { booking: b._id },
    { $setOnInsert: { booking: b._id, artisan: b.artisan, amountKobo: b.pricing.artisanDueKobo, commissionKobo: b.pricing.commissionKobo ?? 0, status: "due", payableAfter: hoursFromNow(POLICY_DEFAULTS.disputeWindowHours) } },
    { upsert: true },
  );
  await ArtisanProfile.updateOne({ _id: b.artisan }, { $inc: { completedJobs: 1 } });
  await releaseSlots(b._id); // job is done; the time is free again
}

export async function completeBooking(id: Types.ObjectId | string, event: "customer_confirm_completion" | "auto_confirm_completion" | "admin_resolve_release", actor: Actor, actorId: Types.ObjectId | null) {
  const b = await moveBooking(id, event, actor, actorId, { completedAt: new Date() }, { expiresAt: 1 });
  if (event === "admin_resolve_release") await Payout.updateOne({ booking: b._id }, { $set: { status: "due" } });
  await afterCompleted(b._id);
  return b;
}

/** Run on a schedule (see /api/cron/sweep). Expires unanswered bookings and auto-confirms silent completions. */
export async function sweep(now = new Date()) {
  let expired = 0, autoCompleted = 0;
  const stale = await Booking.find({ status: { $in: ["pending_artisan_response", "awaiting_customer_approval", "awaiting_payment"] }, expiresAt: { $lt: now } }).select("_id");
  for (const s of stale) {
    try { const b = await moveBooking(s._id, "expire", "system", null, {}, { expiresAt: 1 }); await releaseSlots(b._id); expired++; } catch { /* changed meanwhile: fine */ }
  }
  const cutoff = new Date(now.getTime() - POLICY_DEFAULTS.autoConfirmCompletionHours * 3_600_000);
  const silent = await Booking.find({ status: "in_progress", completionRequestedAt: { $lt: cutoff } }).select("_id");
  for (const s of silent) {
    try { await completeBooking(s._id, "auto_confirm_completion", "system", null); autoCompleted++; } catch { /* ignore */ }
  }
  return { expired, autoCompleted };
}
