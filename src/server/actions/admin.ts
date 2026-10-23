"use server";
import { connectDb } from "../../lib/db";
import { fail, done } from "../../lib/flash";
import { requireUser } from "../../lib/auth/server";
import { audit } from "../../lib/audit";
import { notify } from "../../lib/notify";
import { nairaToKobo } from "../../lib/money";
import { objectId, slugify } from "../../lib/validation";
import { User } from "../../models/user";
import { ArtisanProfile } from "../../models/artisan-profile";
import { ServiceCategory } from "../../models/service";
import { Booking } from "../../models/booking";
import { Payment } from "../../models/payment";
import { Dispute, Location, Payout, Review } from "../../models/misc";
import { PlatformSettings } from "../../models/platform-settings";
import { completeBooking, issueRefund, moveBooking } from "../booking/workflow";
import { releaseSlots } from "../booking/reserve";
import { recomputeRating } from "../booking/ratings";
import { getSettings } from "../../lib/settings";

const str = (f: FormData, k: string) => (f.get(k) ?? "").toString();
const admin = () => requireUser(["admin"]); // every admin action re-checks the role on the server

export async function verifyArtisanAction(form: FormData) {
  const me = await admin();
  const id = str(form, "profileId"), decision = str(form, "decision"), reason = str(form, "reason").trim().slice(0, 500);
  if (!objectId.safeParse(id).success) return fail("/admin/verification", "Not found.");
  await connectDb();
  const p = await ArtisanProfile.findById(id);
  if (!p || p.verificationStatus !== "pending_review") return fail("/admin/verification", "This application is no longer pending.");
  if (decision === "approve") {
    p.verificationStatus = "verified"; p.verifiedAt = new Date(); p.verifiedBy = me._id;
    await p.save();
    await audit(me._id, "artisan.verify", "ArtisanProfile", p._id, { status: "pending_review" }, { status: "verified" });
    await notify(p.user, "You're verified", "Your verification badge is now showing on your profile.", "/artisan/verification");
    return done("/admin/verification", "Artisan verified.");
  }
  if (decision === "reject") {
    if (reason.length < 5) return fail("/admin/verification", "Give a reason so the artisan can fix it.");
    p.verificationStatus = "rejected"; p.rejectionReason = reason;
    await p.save();
    await audit(me._id, "artisan.reject", "ArtisanProfile", p._id, { status: "pending_review" }, { status: "rejected", reason });
    await notify(p.user, "Verification needs changes", reason, "/artisan/verification");
    return done("/admin/verification", "Application rejected.");
  }
  return fail("/admin/verification", "Choose approve or reject.");
}

export async function setUserStatusAction(form: FormData) {
  const me = await admin();
  const id = str(form, "userId"), status = str(form, "status");
  if (!objectId.safeParse(id).success || !["active", "suspended"].includes(status)) return fail("/admin/users", "Invalid request.");
  await connectDb();
  const u = await User.findById(id);
  if (!u) return fail("/admin/users", "User not found.");
  if (u.role === "admin") return fail("/admin/users", "Admin accounts can't be suspended here.");
  const before = u.status; u.status = status as "active" | "suspended"; await u.save();
  await audit(me._id, "user.status", "User", u._id, { status: before }, { status });
  return done("/admin/users", status === "suspended" ? "Account suspended." : "Account reactivated.");
}

export async function featureArtisanAction(form: FormData) {
  const me = await admin();
  const id = str(form, "profileId"), days = Number(str(form, "days"));
  if (!objectId.safeParse(id).success || !Number.isInteger(days) || days < 0 || days > 365) return fail("/admin/users", "Enter 0 to 365 days.");
  await connectDb();
  await ArtisanProfile.updateOne({ _id: id }, days === 0 ? { $unset: { featuredUntil: 1 } } : { $set: { featuredUntil: new Date(Date.now() + days * 86_400_000) } });
  await audit(me._id, "artisan.feature", "ArtisanProfile", id, undefined, { days });
  return done("/admin/users", days === 0 ? "Featured placement removed." : `Featured for ${days} days.`);
}

export async function saveCategoryAction(form: FormData) {
  const me = await admin();
  const id = str(form, "categoryId"), name = str(form, "name").trim().slice(0, 60);
  if (name.length < 2) return fail("/admin/categories", "Enter a category name.");
  await connectDb();
  const fields = { name, slug: slugify(name), featured: form.get("featured") === "on", active: id ? form.get("active") === "on" : true };
  try {
    if (id && objectId.safeParse(id).success) await ServiceCategory.updateOne({ _id: id }, { $set: fields });
    else await ServiceCategory.create(fields);
  } catch (e) {
    if ((e as { code?: number }).code === 11000) return fail("/admin/categories", "A category with that name already exists.");
    throw e;
  }
  await audit(me._id, "category.save", "ServiceCategory", id || fields.slug, undefined, fields);
  return done("/admin/categories", "Category saved.");
}

export async function saveLocationAction(form: FormData) {
  const me = await admin();
  const state = slugify(str(form, "state")), city = slugify(str(form, "city")), name = str(form, "name").trim().slice(0, 80);
  if (!state || !city || !name) return fail("/admin/settings", "Enter state, city and area name.");
  await connectDb();
  const slug = `${state}/${city}/${slugify(name)}`;
  await Location.updateOne({ slug }, { $set: { slug, state, city, name, active: true } }, { upsert: true });
  await audit(me._id, "location.add", "Location", slug);
  return done("/admin/settings", "Area added.");
}

export async function saveSettingsAction(form: FormData) {
  const me = await admin();
  const pct = (k: string) => { const n = Number(str(form, k)); return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n * 100) : null; };
  const commissionBps = pct("commission"), customerFeeBps = pct("customerFee");
  const flat = nairaToKobo(form.get("customerFeeFlat")) ?? 0;
  const capRaw = str(form, "customerFeeCap").trim();
  const cap = capRaw === "" ? null : nairaToKobo(capRaw);
  if (commissionBps === null || customerFeeBps === null) return fail("/admin/settings", "Percentages must be between 0 and 100.");
  const tiers = [0, 1, 2].map((i) => ({ minHoursBeforeStart: Number(str(form, `tierHours${i}`)), refundBps: Math.round(Number(str(form, `tierPct${i}`)) * 100) }));
  if (tiers.some((t) => !Number.isFinite(t.minHoursBeforeStart) || t.minHoursBeforeStart < 0 || t.refundBps < 0 || t.refundBps > 10000 || Number.isNaN(t.refundBps))) return fail("/admin/settings", "Check the refund tiers.");
  const cities = str(form, "launchCities").split(",").map((c) => slugify(c)).filter(Boolean);
  if (!cities.length) return fail("/admin/settings", "Enter at least one launch state or city (for example: ogun).");
  await connectDb();
  const before = await getSettings();
  const after = { commissionBps, customerFeeBps, customerFeeFlatKobo: flat, customerFeeCapKobo: cap, cancelTiers: tiers, launchCities: cities };
  await PlatformSettings.updateOne({ key: "global" }, { $set: after }, { upsert: true });
  await audit(me._id, "settings.update", "PlatformSettings", "global", before, after);
  return done("/admin/settings", "Settings saved. They apply to new bookings only.");
}

export async function resolveDisputeAction(form: FormData) {
  const me = await admin();
  const id = str(form, "disputeId"), resolution = str(form, "resolution"), note = str(form, "note").trim().slice(0, 1000);
  const back = "/admin/disputes";
  if (!objectId.safeParse(id).success || !["release_to_artisan", "refund_customer"].includes(resolution)) return fail(back, "Choose a decision.");
  if (note.length < 10) return fail(back, "Write a short note explaining your decision.");
  await connectDb();
  const d = await Dispute.findById(id);
  if (!d || d.status !== "open") return fail(back, "This dispute is already resolved.");
  const b = await Booking.findById(d.booking);
  if (!b) return fail(back, "Booking not found.");
  try {
    const artisanUser = (await ArtisanProfile.findById(b.artisan).select("user").lean())?.user;
    if (resolution === "release_to_artisan") {
      await completeBooking(b._id, "admin_resolve_release", "admin", me._id);
    } else {
      await moveBooking(b._id, "admin_resolve_refund", "admin", me._id, { cancellation: { by: "admin", reason: `Dispute: ${d.reason}`, at: new Date(), refundKobo: b.pricing?.totalKobo } }, { expiresAt: 1 });
      await releaseSlots(b._id);
      const pay = await Payment.findOne({ booking: b._id, status: "success" });
      if (pay) await issueRefund(pay._id, pay.amountKobo, `Dispute resolved for customer: ${d.reason}`);
      if (d.reason === "no_show" && d.openedByRole === "customer") await ArtisanProfile.updateOne({ _id: b.artisan }, { $inc: { noShowCount: 1 } });
    }
    Object.assign(d, { status: "resolved", resolution, resolutionNote: note, resolvedBy: me._id, resolvedAt: new Date() });
    await d.save();
    await audit(me._id, "dispute.resolve", "Dispute", d._id, { status: "open" }, { resolution, note });
    const msg = resolution === "refund_customer" ? "Decided in the customer's favour. Any payment is being refunded." : "Decided in the artisan's favour. The job is marked complete.";
    await notify(b.customer, "Your report was reviewed", msg, `/dashboard/bookings/${b._id}`);
    if (artisanUser) await notify(artisanUser, "A reported booking was reviewed", msg, `/artisan/bookings/${b._id}`);
  } catch (e) { return fail(back, (e as Error).message); }
  return done(back, "Dispute resolved.");
}

export async function markPayoutPaidAction(form: FormData) {
  const me = await admin();
  const id = str(form, "payoutId"), ref = str(form, "transferReference").trim().slice(0, 100);
  if (!objectId.safeParse(id).success || ref.length < 3) return fail("/admin/payments", "Enter the bank transfer reference.");
  await connectDb();
  const p = await Payout.findById(id);
  if (!p || p.status !== "due") return fail("/admin/payments", "This payout is not payable.");
  if (p.payableAfter && p.payableAfter.getTime() > Date.now()) return fail("/admin/payments", "Wait until the dispute window has passed.");
  const r = await Payout.updateOne({ _id: p._id, status: "due" }, { $set: { status: "paid", paidAt: new Date(), transferReference: ref, paidBy: me._id } });
  if (!r.modifiedCount) return fail("/admin/payments", "Already paid.");
  await audit(me._id, "payout.paid", "Payout", p._id, { status: "due" }, { status: "paid", amountKobo: p.amountKobo });
  const profile = await ArtisanProfile.findById(p.artisan).select("user").lean();
  if (profile) await notify(profile.user, "Payout sent", "A payout was sent to your bank account.", "/artisan/earnings");
  return done("/admin/payments", "Marked as paid.");
}

export async function moderateReviewAction(form: FormData) {
  const me = await admin();
  const id = str(form, "reviewId"), hide = str(form, "hide") === "1";
  if (!objectId.safeParse(id).success) return fail("/admin/reviews", "Not found.");
  await connectDb();
  const r = await Review.findByIdAndUpdate(id, { $set: { hidden: hide } });
  if (!r) return fail("/admin/reviews", "Not found.");
  await recomputeRating(r.artisan);
  await audit(me._id, hide ? "review.hide" : "review.restore", "Review", id);
  return done("/admin/reviews", hide ? "Review hidden." : "Review restored.");
}
