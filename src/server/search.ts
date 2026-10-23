import { connectDb } from "@/lib/db";
import { escapeRegex } from "@/lib/validation";
import { Service, ServiceCategory } from "@/models/service";
import { ArtisanProfile } from "@/models/artisan-profile";
import { User } from "@/models/user";
import { localParts } from "@/domain/availability";

export interface SearchParams { q?: string; category?: string; area?: string; type?: string; verified?: string; min?: string; max?: string; rating?: string; date?: string; sort?: string; page?: string }
export const PAGE_SIZE = 12;

/**
 * MongoDB-backed search. Only artisans who are active, not paused, and have working hours set are listed
 * (otherwise nobody could book them). Everything user-supplied is validated or regex-escaped.
 */
export async function searchServices(p: SearchParams) {
  await connectDb();
  const page = Math.max(1, Math.min(200, parseInt(p.page ?? "1") || 1));
  const match: Record<string, unknown> = { active: true };
  if (p.q?.trim()) match.title = { $regex: escapeRegex(p.q.trim().slice(0, 60)), $options: "i" };
  if (p.category && /^[a-z0-9-]+$/.test(p.category)) {
    const c = await ServiceCategory.findOne({ slug: p.category, active: true }).select("_id").lean();
    match.category = c?._id ?? null;
  }
  if (p.type && ["fixed", "starting_from", "quote"].includes(p.type)) match.pricingModel = p.type;
  const min = Number(p.min), max = Number(p.max);
  if ((p.min && Number.isFinite(min)) || (p.max && Number.isFinite(max))) {
    const r: Record<string, number> = {};
    if (p.min && Number.isFinite(min)) r.$gte = Math.round(min * 100);
    if (p.max && Number.isFinite(max)) r.$lte = Math.round(max * 100);
    match.priceKobo = r; // quote-based services have no price, so they drop out of price filters
  }
  const am: Record<string, unknown> = { "a.paused": { $ne: true }, "a.workingWindows.0": { $exists: true }, "u.status": "active" };
  if (p.area && /^[a-z0-9/-]+$/.test(p.area)) am["a.serviceAreas"] = { $regex: `^${escapeRegex(p.area)}` };
  if (p.verified === "1") am["a.verificationStatus"] = "verified";
  const rating = Number(p.rating);
  if (p.rating && rating >= 1 && rating <= 5) am["a.ratingCount"] = { $gt: 0 }, am["a.ratingAvg"] = { $gte: rating }; // only real reviews count
  if (p.date && /^\d{4}-\d{2}-\d{2}$/.test(p.date)) {
    const wd = localParts(new Date(`${p.date}T12:00:00Z`)).dayOfWeek;
    am["a.workingWindows.dayOfWeek"] = wd; am["a.blackoutDates"] = { $ne: p.date };
  }
  const now = new Date();
  const sort: Record<string, 1 | -1> =
    p.sort === "price_asc" ? { priceKobo: 1, _id: 1 } : p.sort === "rating" ? { "a.ratingAvg": -1, _id: 1 } : p.sort === "newest" ? { createdAt: -1 } : { featured: -1, verified: -1, "a.ratingAvg": -1, _id: 1 };

  const [res] = await Service.aggregate([
    { $match: match },
    { $lookup: { from: ArtisanProfile.collection.name, localField: "artisan", foreignField: "_id", as: "a" } }, { $unwind: "$a" },
    { $lookup: { from: User.collection.name, localField: "a.user", foreignField: "_id", as: "u" } }, { $unwind: "$u" },
    { $match: am },
    { $addFields: { featured: { $cond: [{ $gt: ["$a.featuredUntil", now] }, 1, 0] }, verified: { $cond: [{ $eq: ["$a.verificationStatus", "verified"] }, 1, 0] } } },
    { $sort: sort },
    { $facet: { items: [{ $skip: (page - 1) * PAGE_SIZE }, { $limit: PAGE_SIZE }, { $project: { title: 1, pricingModel: 1, priceKobo: 1, durationMinutes: 1, featured: 1, "a._id": 1, "a.slug": 1, "a.displayName": 1, "a.verificationStatus": 1, "a.ratingAvg": 1, "a.ratingCount": 1, "a.completedJobs": 1, "a.serviceAreas": 1 } }], total: [{ $count: "n" }] } },
  ]);
  const total: number = res?.total?.[0]?.n ?? 0;
  return { items: (res?.items ?? []) as any[], total, page, pages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}
