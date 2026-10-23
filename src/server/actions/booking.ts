"use server";
import { Types } from "mongoose";
import { redirect } from "next/navigation";
import { connectDb } from "../../lib/db";
import { env } from "../../lib/env";
import { fail, done } from "../../lib/flash";
import { requireUser } from "../../lib/auth/server";
import { nairaToKobo } from "../../lib/money";
import { getSettings } from "../../lib/settings";
import { notify } from "../../lib/notify";
import { getPaymentProvider } from "../../lib/payments/provider";
import { bookingSchema, objectId } from "../../lib/validation";
import { computeBreakdown } from "../../domain/pricing";
import { fitsWorkingHours } from "../../domain/availability";
import { POLICY_DEFAULTS } from "../../domain/policy";
import { Booking } from "../../models/booking";
import { Service } from "../../models/service";
import { ArtisanProfile } from "../../models/artisan-profile";
import { Payment } from "../../models/payment";
import { Dispute, Message, Review } from "../../models/misc";
import { User } from "../../models/user";
import { Payout } from "../../models/misc";
import { reserveSlots, SlotTakenError, releaseSlots } from "../booking/reserve";
import { toWindows } from "../booking/windows";
import { recomputeRating } from "../booking/ratings";
import { cancelBooking, completeBooking, hoursFromNow, moveBooking, newReference, setSlotHold } from "../booking/workflow";
import { InvalidTransitionError } from "../../domain/booking-state";
import { savePrivateFile } from "../../lib/storage";

const str = (f: FormData, k: string) => (f.get(k) ?? "").toString();
const msgOf = (e: unknown) => (e instanceof InvalidTransitionError || e instanceof SlotTakenError || e instanceof Error ? e.message : "Something went wrong. Please try again.");

/** Which side of a booking is this user? Returns null if they have no right to it. */
async function loadForUser(user: { _id: Types.ObjectId; role: string }, id: string) {
  if (!objectId.safeParse(id).success) return null;
  const b = await Booking.findById(id);
  if (!b) return null;
  if (user.role === "admin") return { b, side: "admin" as const };
  if (user.role === "customer" && b.customer.equals(user._id)) return { b, side: "customer" as const };
  if (user.role === "artisan") {
    const p = await ArtisanProfile.findOne({ user: user._id }).select("_id").lean();
    if (p && b.artisan.equals(p._id)) return { b, side: "artisan" as const };
  }
  return null; // wrong person: behaves exactly like "not found"
}

export async function createBookingAction(form: FormData) {
  const user = await requireUser(["customer"]);
  const serviceId = str(form, "serviceId");
  const back = `/services/${serviceId}`;
  const parsed = bookingSchema.safeParse({ serviceId, startsAt: str(form, "startsAt"), line1: str(form, "line1"), area: str(form, "area"), landmark: str(form, "landmark") || undefined, notes: str(form, "notes") || undefined });
  if (!parsed.success) return fail(back, parsed.error.issues[0]?.message ?? "Check the form.");
  if (!user.emailVerifiedAt) return fail(back, "Please verify your email before booking. We sent you a link.");
  await connectDb();
  const service = await Service.findById(parsed.data.serviceId);
  const artisan = service?.active ? await ArtisanProfile.findById(service.artisan) : null;
  const artisanUser = artisan ? await User.findById(artisan.user).select("status").lean() : null;
  if (!service || !artisan || artisan.paused || artisanUser?.status !== "active") return fail("/services", "This service is not available right now.");

  const startsAt = new Date(parsed.data.startsAt);
  if (startsAt.getTime() < Date.now() + 2 * 3_600_000) return fail(back, "Please choose a time at least 2 hours from now.");
  if (!fitsWorkingHours(startsAt, service.durationMinutes, toWindows(artisan.workingWindows), [...(artisan.blackoutDates ?? [])])) return fail(back, "That time is outside this artisan's working hours.");

  const settings = await getSettings();
  // Prices are computed HERE from the artisan's stored price. Nothing price-related is read from the form.
  const pricing = service.pricingModel === "quote" ? { travelKobo: service.travelKobo ?? 0 } : computeBreakdown(service.priceKobo!, service.travelKobo ?? 0, settings);

  const bookingId = new Types.ObjectId();
  const expiresAt = hoursFromNow(POLICY_DEFAULTS.artisanResponseHours);
  try {
    await reserveSlots({ artisanId: artisan._id, bookingId, startsAt, durationMinutes: service.durationMinutes, holdExpiresAt: expiresAt });
    await Booking.create({
      _id: bookingId, reference: newReference(), customer: user._id, artisan: artisan._id, service: service._id, serviceTitle: service.title, pricingModel: service.pricingModel,
      startsAt, durationMinutes: service.durationMinutes, address: { line1: parsed.data.line1, area: parsed.data.area, landmark: parsed.data.landmark }, notes: parsed.data.notes,
      expiresAt, pricing, statusHistory: [{ from: null, to: "pending_artisan_response", event: "created", actor: "customer", actorId: user._id, at: new Date() }],
    });
  } catch (e) {
    await releaseSlots(bookingId);
    return fail(back, msgOf(e));
  }
  await notify(artisan.user, "New booking request", `${service.title} on ${startsAt.toLocaleDateString("en-NG")}. Respond within ${POLICY_DEFAULTS.artisanResponseHours} hours.`, `/artisan/bookings/${bookingId}`);
  redirect(`/dashboard/bookings/${bookingId}?ok=Request sent. We'll notify you when the artisan responds.`);
}

export async function attachPhotoAction(form: FormData) {
  const user = await requireUser(["customer"]);
  const id = str(form, "bookingId");
  const path = `/dashboard/bookings/${id}`;
  await connectDb();
  const ctx = await loadForUser(user, id);
  if (!ctx || ctx.side !== "customer") return fail("/dashboard/bookings", "Booking not found.");
  const file = form.get("photo");
  if (!(file instanceof File) || file.size === 0) return fail(path, "Choose a photo first.");
  if ((ctx.b.mediaKeys?.length ?? 0) >= 5) return fail(path, "You can add up to 5 photos.");
  try {
    const key = await savePrivateFile(file);
    await Booking.updateOne({ _id: ctx.b._id }, { $push: { mediaKeys: key } });
  } catch (e) { return fail(path, msgOf(e)); }
  return done(path, "Photo added.");
}

export async function artisanRespondAction(form: FormData) {
  const user = await requireUser(["artisan"]);
  const id = str(form, "bookingId");
  const decision = str(form, "decision"); // accept | reject | quote
  const path = `/artisan/bookings/${id}`;
  await connectDb();
  const ctx = await loadForUser(user, id);
  if (!ctx || ctx.side !== "artisan") return fail("/artisan/bookings", "Booking not found.");
  const { b } = ctx;
  const settings = await getSettings();
  let customerMsg = "";
  try {
    if (decision === "reject") {
      await moveBooking(b._id, "artisan_reject", "artisan", user._id, { cancellation: { by: "artisan", reason: str(form, "reason").slice(0, 300) || "Artisan declined", at: new Date() } }, { expiresAt: 1 });
      await releaseSlots(b._id);
      customerMsg = "The artisan can't take this job. Your slot was released, so you can pick another artisan.";
    } else if (decision === "accept" || decision === "quote") {
      const travel = b.pricing?.travelKobo ?? 0;
      const chargeKobo = b.pricingModel === "fixed" ? b.pricing?.serviceChargeKobo ?? null : nairaToKobo(form.get("price"));
      if (!chargeKobo || chargeKobo <= 0) return fail(path, "Enter the price in naira.");
      const pricing = computeBreakdown(chargeKobo, travel, settings);
      const event = decision === "quote" ? "artisan_submit_quote" : "artisan_accept";
      const hold = decision === "quote" ? hoursFromNow(POLICY_DEFAULTS.quoteApprovalHours) : hoursFromNow(POLICY_DEFAULTS.paymentHoldMinutes / 60);
      await moveBooking(b._id, event, "artisan", user._id, { pricing, expiresAt: hold, quoteNote: str(form, "note").slice(0, 1000) || undefined });
      await setSlotHold(b._id, hold);
      customerMsg = decision === "quote" ? "You have a quote to review." : "Your booking was accepted. Pay now to confirm your slot.";
    } else return fail(path, "Choose accept, quote or decline.");
  } catch (e) { return fail(path, msgOf(e)); }
  await notify(b.customer, decision === "reject" ? "Booking declined" : decision === "quote" ? "Quote received" : "Booking accepted", customerMsg, `/dashboard/bookings/${b._id}`);
  return done(path, decision === "reject" ? "Booking declined." : decision === "quote" ? "Quote sent to the customer." : "Accepted. The customer can now pay.");
}

export async function customerBookingAction(form: FormData) {
  const user = await requireUser(["customer"]);
  const id = str(form, "bookingId");
  const op = str(form, "op"); // approve_quote | decline_quote | cancel | confirm_completion
  const path = `/dashboard/bookings/${id}`;
  await connectDb();
  const ctx = await loadForUser(user, id);
  if (!ctx || ctx.side !== "customer") return fail("/dashboard/bookings", "Booking not found.");
  const { b } = ctx;
  const artisanUserId = (await ArtisanProfile.findById(b.artisan).select("user").lean())?.user;
  try {
    if (op === "approve_quote") {
      const hold = hoursFromNow(POLICY_DEFAULTS.paymentHoldMinutes / 60);
      await moveBooking(b._id, "customer_approve_quote", "customer", user._id, { expiresAt: hold });
      await setSlotHold(b._id, hold);
      if (artisanUserId) await notify(artisanUserId, "Quote approved", "The customer approved your quote and will pay shortly.", `/artisan/bookings/${b._id}`);
      return done(path, "Quote approved. Pay now to confirm your slot.");
    }
    if (op === "decline_quote") {
      await moveBooking(b._id, "customer_decline_quote", "customer", user._id, { cancellation: { by: "customer", reason: "Quote declined", at: new Date() } }, { expiresAt: 1 });
      await releaseSlots(b._id);
      return done("/dashboard/bookings", "Quote declined.");
    }
    if (op === "cancel") {
      const { decision } = await cancelBooking(b._id, "customer", user._id, str(form, "reason").slice(0, 300) || "Cancelled by customer");
      if (artisanUserId) await notify(artisanUserId, "Booking cancelled", "A customer cancelled a booking.", `/artisan/bookings/${b._id}`);
      return done(path, decision.refundKobo > 0 ? `Cancelled. ${decision.reason} Refunds can take a few days to reach your bank.` : `Cancelled. ${decision.reason}`);
    }
    if (op === "confirm_completion") {
      await completeBooking(b._id, "customer_confirm_completion", "customer", user._id);
      if (artisanUserId) await notify(artisanUserId, "Job confirmed complete", "The customer confirmed the job is done.", `/artisan/bookings/${b._id}`);
      return done(path, "Thanks for confirming. You can now leave a review.");
    }
  } catch (e) { return fail(path, msgOf(e)); }
  return fail(path, "Unknown action.");
}

export async function artisanJobAction(form: FormData) {
  const user = await requireUser(["artisan"]);
  const id = str(form, "bookingId");
  const op = str(form, "op"); // start | request_completion | cancel
  const path = `/artisan/bookings/${id}`;
  await connectDb();
  const ctx = await loadForUser(user, id);
  if (!ctx || ctx.side !== "artisan") return fail("/artisan/bookings", "Booking not found.");
  const { b } = ctx;
  try {
    if (op === "start") {
      if (Date.now() < b.startsAt.getTime() - 2 * 3_600_000) return fail(path, "You can start a job up to 2 hours before its scheduled time.");
      await moveBooking(b._id, "artisan_start", "artisan", user._id);
      return done(path, "Job started.");
    }
    if (op === "request_completion") {
      if (b.status !== "in_progress") return fail(path, "Start the job first.");
      await Booking.updateOne({ _id: b._id }, { $set: { completionRequestedAt: new Date() } });
      await notify(b.customer, "Job finished?", "Your artisan says the job is done. Please confirm, or report a problem.", `/dashboard/bookings/${b._id}`);
      return done(path, "Customer asked to confirm. If they don't respond in 48 hours the job is confirmed automatically.");
    }
    if (op === "cancel") {
      await cancelBooking(b._id, "artisan", user._id, str(form, "reason").slice(0, 300) || "Cancelled by artisan");
      await notify(b.customer, "Booking cancelled by artisan", "Your artisan cancelled. Any payment will be refunded in full.", `/dashboard/bookings/${b._id}`);
      return done(path, "Cancelled. The customer is refunded in full. Frequent cancellations affect your profile.");
    }
  } catch (e) { return fail(path, msgOf(e)); }
  return fail(path, "Unknown action.");
}

export async function payBookingAction(form: FormData) {
  const user = await requireUser(["customer"]);
  const id = str(form, "bookingId");
  const path = `/dashboard/bookings/${id}`;
  await connectDb();
  const ctx = await loadForUser(user, id);
  if (!ctx || ctx.side !== "customer") return fail("/dashboard/bookings", "Booking not found.");
  const { b } = ctx;
  if (b.status !== "awaiting_payment" || !b.pricing?.totalKobo) return fail(path, "This booking isn't ready for payment.");
  // Reuse an unfinished payment attempt so a double-click never creates two charges.
  let payment = await Payment.findOne({ booking: b._id, status: "initialized" });
  const provider = getPaymentProvider();
  let url: string;
  try {
    if (!payment) {
      payment = await Payment.create({ booking: b._id, customer: user._id, provider: provider.name, reference: newReference("PAY"), amountKobo: b.pricing.totalKobo, breakdown: { serviceChargeKobo: b.pricing.serviceChargeKobo, travelKobo: b.pricing.travelKobo, customerFeeKobo: b.pricing.customerFeeKobo, commissionKobo: b.pricing.commissionKobo, artisanDueKobo: b.pricing.artisanDueKobo } });
    }
    const init = await provider.initialize({ email: user.email, amountKobo: payment.amountKobo, reference: payment.reference, callbackUrl: `${env.APP_URL}/payments/callback`, metadata: { booking: b.reference } });
    url = init.authorizationUrl;
  } catch (e) { return fail(path, msgOf(e)); }
  redirect(url);
}

export async function sendMessageAction(form: FormData) {
  const user = await requireUser(["customer", "artisan"]);
  const id = str(form, "bookingId");
  const body = str(form, "body").trim().slice(0, 1000);
  await connectDb();
  const ctx = await loadForUser(user, id);
  const base = user.role === "artisan" ? "/artisan/bookings" : "/dashboard/bookings";
  if (!ctx || ctx.side === "admin") return fail(base, "Booking not found.");
  if (!body) return fail(`${base}/${id}`, "Write a message first.");
  if (["cancelled", "expired"].includes(ctx.b.status)) return fail(`${base}/${id}`, "This booking is closed.");
  await Message.create({ booking: ctx.b._id, from: user._id, fromRole: ctx.side, body });
  const otherUser = ctx.side === "customer" ? (await ArtisanProfile.findById(ctx.b.artisan).select("user").lean())?.user : ctx.b.customer;
  if (otherUser) await notify(otherUser, "New message", "You have a new message about a booking.", `${ctx.side === "customer" ? "/artisan" : "/dashboard"}/bookings/${ctx.b._id}`);
  return done(`${base}/${id}`, "Message sent.");
}

export async function openDisputeAction(form: FormData) {
  const user = await requireUser(["customer", "artisan"]);
  const id = str(form, "bookingId");
  const reason = str(form, "reason");
  const text = str(form, "text").trim().slice(0, 2000);
  const base = user.role === "artisan" ? "/artisan/bookings" : "/dashboard/bookings";
  await connectDb();
  const ctx = await loadForUser(user, id);
  if (!ctx || ctx.side === "admin") return fail(base, "Booking not found.");
  if (!["no_show", "incomplete_work", "poor_quality", "price_mismatch", "customer_refused_to_pay", "other"].includes(reason)) return fail(`${base}/${id}`, "Choose what went wrong.");
  if (text.length < 10) return fail(`${base}/${id}`, "Describe what happened (at least a sentence).");
  const b = ctx.b;
  if (b.status === "completed" && b.completedAt && Date.now() - b.completedAt.getTime() > POLICY_DEFAULTS.disputeWindowHours * 3_600_000) return fail(`${base}/${id}`, "The 72-hour window to report a problem has passed.");
  try {
    await moveBooking(b._id, "open_dispute", ctx.side, user._id);
    await Dispute.create({ booking: b._id, openedBy: user._id, openedByRole: ctx.side, reason, statements: [{ by: user._id, role: ctx.side, text, at: new Date() }] });
    await Payout.updateOne({ booking: b._id }, { $set: { status: "withheld" } }); // hold the artisan's money while we look
    const otherUser = ctx.side === "customer" ? (await ArtisanProfile.findById(b.artisan).select("user").lean())?.user : b.customer;
    if (otherUser) await notify(otherUser, "A problem was reported", "Please add your side of the story so we can review fairly.", `${ctx.side === "customer" ? "/artisan" : "/dashboard"}/bookings/${b._id}`);
  } catch (e) { return fail(`${base}/${id}`, msgOf(e)); }
  return done(`${base}/${id}`, "Reported. Our team will review it. You can add more details below.");
}

export async function addStatementAction(form: FormData) {
  const user = await requireUser(["customer", "artisan"]);
  const id = str(form, "bookingId");
  const text = str(form, "text").trim().slice(0, 2000);
  const base = user.role === "artisan" ? "/artisan/bookings" : "/dashboard/bookings";
  await connectDb();
  const ctx = await loadForUser(user, id);
  if (!ctx || ctx.side === "admin") return fail(base, "Booking not found.");
  if (text.length < 5) return fail(`${base}/${id}`, "Write something first.");
  const r = await Dispute.updateOne({ booking: ctx.b._id, status: "open" }, { $push: { statements: { by: user._id, role: ctx.side, text, at: new Date() } } });
  if (!r.matchedCount) return fail(`${base}/${id}`, "There is no open report for this booking.");
  return done(`${base}/${id}`, "Added to the report.");
}

export async function reviewAction(form: FormData) {
  const user = await requireUser(["customer"]);
  const id = str(form, "bookingId");
  const path = `/dashboard/bookings/${id}`;
  const rating = Number(str(form, "rating"));
  await connectDb();
  const ctx = await loadForUser(user, id);
  if (!ctx || ctx.side !== "customer") return fail("/dashboard/bookings", "Booking not found.");
  if (ctx.b.status !== "completed") return fail(path, "You can review once the job is completed.");
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) return fail(path, "Choose a rating from 1 to 5.");
  try {
    await Review.create({ booking: ctx.b._id, customer: user._id, artisan: ctx.b.artisan, rating, comment: str(form, "comment").trim().slice(0, 1000) || undefined });
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return fail(path, "You already reviewed this booking.");
    throw e;
  }
  await recomputeRating(ctx.b.artisan);
  return done(path, "Thanks for your review.");
}

export async function reportReviewAction(form: FormData) {
  const user = await requireUser(["artisan"]);
  const reviewId = str(form, "reviewId");
  const reason = str(form, "reason").trim().slice(0, 300);
  await connectDb();
  const profile = await ArtisanProfile.findOne({ user: user._id }).select("_id").lean();
  if (!profile || !objectId.safeParse(reviewId).success || reason.length < 5) return fail("/artisan/reviews", "Describe why this review should be checked.");
  await Review.updateOne({ _id: reviewId, artisan: profile._id }, { $push: { reports: { by: user._id, reason, at: new Date() } } });
  return done("/artisan/reviews", "Reported to our team for moderation.");
}
