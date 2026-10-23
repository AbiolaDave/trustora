"use server";
import { connectDb } from "@/lib/db";
import { fail, done } from "@/lib/flash";
import { requireArtisan } from "@/lib/auth/server";
import { nairaToKobo } from "@/lib/money";
import { serviceSchema, objectId } from "@/lib/validation";
import { ArtisanProfile } from "@/models/artisan-profile";
import { Service, ServiceCategory } from "@/models/service";
import { Booking } from "@/models/booking";
import { Location } from "@/models/misc";
import { savePrivateFile } from "@/lib/storage";
import { SLOT_HOLDING_STATES } from "@/domain/booking-state";

const str = (f: FormData, k: string) => (f.get(k) ?? "").toString();

export async function saveArtisanProfileAction(form: FormData) {
  const { profile } = await requireArtisan();
  if (!profile) return fail("/artisan/profile", "Profile not found.");
  const displayName = str(form, "displayName").trim();
  const bio = str(form, "bio").trim().slice(0, 1500);
  const years = Number(str(form, "yearsExperience"));
  const skills = str(form, "skills").split(",").map((s) => s.trim()).filter(Boolean).slice(0, 15);
  if (displayName.length < 2) return fail("/artisan/profile", "Enter the name customers will see.");
  if (!Number.isFinite(years) || years < 0 || years > 60) return fail("/artisan/profile", "Enter years of experience (0 to 60).");
  await connectDb();
  const picked = form.getAll("areas").map(String);
  const valid = await Location.find({ slug: { $in: picked }, active: true }).select("slug").lean(); // only configured areas are accepted
  await ArtisanProfile.updateOne({ _id: profile._id }, { $set: { displayName, bio, yearsExperience: years, skills, serviceAreas: valid.map((l) => l.slug) } });
  return done("/artisan/profile", "Profile saved.");
}

export async function saveBankAction(form: FormData) {
  const { profile } = await requireArtisan();
  if (!profile) return fail("/artisan/earnings", "Profile not found.");
  const acct = str(form, "accountNumber").replace(/\s/g, "");
  const bank = str(form, "bankName").trim().slice(0, 80);
  const name = str(form, "accountName").trim().slice(0, 120);
  if (!/^\d{10}$/.test(acct)) return fail("/artisan/earnings", "Account number must be 10 digits.");
  if (!bank || !name) return fail("/artisan/earnings", "Enter your bank and the account name.");
  await connectDb();
  await ArtisanProfile.updateOne({ _id: profile._id }, { $set: { payoutBankName: bank, payoutAccountName: name, payoutAccountNumber: acct, payoutBankLast4: acct.slice(-4) } });
  return done("/artisan/earnings", "Bank details saved.");
}

export async function saveServiceAction(form: FormData) {
  const { profile } = await requireArtisan();
  const id = str(form, "serviceId");
  const back = id ? `/artisan/services/${id}` : "/artisan/services";
  if (!profile) return fail(back, "Complete your profile first.");
  const parsed = serviceSchema.safeParse({ title: str(form, "title"), description: str(form, "description") || undefined, category: str(form, "category"), pricingModel: str(form, "pricingModel"), durationMinutes: str(form, "durationMinutes") });
  if (!parsed.success) return fail(back, parsed.error.issues[0]?.message ?? "Check the form.");
  const priceKobo = nairaToKobo(form.get("price"));
  const travelKobo = nairaToKobo(form.get("travel")) ?? 0;
  if (parsed.data.pricingModel !== "quote" && (!priceKobo || priceKobo <= 0)) return fail(back, "Enter a price in naira.");
  await connectDb();
  if (!(await ServiceCategory.exists({ _id: parsed.data.category, active: true }))) return fail(back, "Choose a category.");
  const fields = { ...parsed.data, priceKobo: parsed.data.pricingModel === "quote" ? undefined : priceKobo ?? undefined, travelKobo };
  if (id) {
    if (!objectId.safeParse(id).success) return fail("/artisan/services", "Service not found.");
    const r = await Service.findOne({ _id: id, artisan: profile._id }); // ownership check
    if (!r) return fail("/artisan/services", "Service not found.");
    r.set(fields); await r.save(); // save() so validators run
  } else {
    await Service.create({ ...fields, artisan: profile._id });
  }
  return done("/artisan/services", "Service saved.");
}

export async function toggleServiceAction(form: FormData) {
  const { profile } = await requireArtisan();
  const id = str(form, "serviceId");
  if (!profile || !objectId.safeParse(id).success) return fail("/artisan/services", "Service not found.");
  await connectDb();
  const s = await Service.findOne({ _id: id, artisan: profile._id });
  if (!s) return fail("/artisan/services", "Service not found.");
  s.active = !s.active; await s.save();
  return done("/artisan/services", s.active ? "Service is live." : "Service hidden from customers.");
}

const toMinutes = (v: string) => { const m = /^(\d{2}):(\d{2})$/.exec(v); return m ? Number(m[1]) * 60 + Number(m[2]) : null; };

export async function saveAvailabilityAction(form: FormData) {
  const { profile } = await requireArtisan();
  if (!profile) return fail("/artisan/availability", "Profile not found.");
  const windows: { dayOfWeek: number; startMinute: number; endMinute: number }[] = [];
  for (let d = 0; d < 7; d++) {
    if (!form.get(`day${d}`)) continue;
    const s = toMinutes(str(form, `start${d}`)), e = toMinutes(str(form, `end${d}`));
    if (s === null || e === null || e <= s) return fail("/artisan/availability", "Each working day needs a start time before its end time.");
    windows.push({ dayOfWeek: d, startMinute: s, endMinute: e });
  }
  const blackout = str(form, "blackout").split(/[\s,]+/).filter(Boolean);
  if (blackout.some((b) => !/^\d{4}-\d{2}-\d{2}$/.test(b))) return fail("/artisan/availability", "Use dates like 2026-12-25, one per line.");
  await connectDb();
  await ArtisanProfile.updateOne({ _id: profile._id }, { $set: { workingWindows: windows, blackoutDates: blackout, paused: form.get("paused") === "on" } });
  return done("/artisan/availability", "Availability saved. Existing bookings are not affected.");
}

export async function submitVerificationAction(form: FormData) {
  const { user, profile } = await requireArtisan();
  const back = "/artisan/verification";
  if (!profile) return fail(back, "Profile not found.");
  if (!user.emailVerifiedAt) return fail(back, "Verify your email first. We sent you a link.");
  if (profile.verificationStatus === "verified") return fail(back, "You are already verified.");
  if (profile.verificationStatus === "pending_review") return fail(back, "Your documents are already being reviewed.");
  if (!profile.bio || !profile.serviceAreas?.length) return fail(back, "Complete your profile first: add a bio and at least one area you serve.");
  const kind = str(form, "idKind");
  if (!["national_id", "drivers_license", "voters_card", "passport"].includes(kind)) return fail(back, "Choose which ID you are uploading.");
  const idFile = form.get("idFile"), selfie = form.get("selfie");
  if (!(idFile instanceof File) || idFile.size === 0 || !(selfie instanceof File) || selfie.size === 0) return fail(back, "Upload your ID and a clear selfie holding it.");
  try {
    const docs = [{ kind, storageKey: await savePrivateFile(idFile), uploadedAt: new Date() }, { kind: "selfie", storageKey: await savePrivateFile(selfie), uploadedAt: new Date() }];
    await connectDb();
    await ArtisanProfile.updateOne({ _id: profile._id }, { $set: { verificationDocs: docs, verificationStatus: "pending_review" }, $unset: { rejectionReason: 1 } });
  } catch (e) { return fail(back, (e as Error).message); }
  return done(back, "Submitted. We usually review within 2 working days.");
}

export async function pauseSummary(profileId: unknown) {
  return Booking.countDocuments({ artisan: profileId, status: { $in: SLOT_HOLDING_STATES as string[] } });
}
