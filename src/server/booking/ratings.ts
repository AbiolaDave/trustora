import type { Types } from "mongoose";
import { ArtisanProfile } from "../../models/artisan-profile";
import { Review } from "../../models/misc";

/** Ratings are always recomputed from real, visible reviews. Never set from client input. */
export async function recomputeRating(artisanId: Types.ObjectId) {
  const [agg] = await Review.aggregate([{ $match: { artisan: artisanId, hidden: false } }, { $group: { _id: null, avg: { $avg: "$rating" }, n: { $sum: 1 } } }]);
  await ArtisanProfile.updateOne({ _id: artisanId }, { $set: { ratingAvg: agg ? Math.round(agg.avg * 10) / 10 : 0, ratingCount: agg?.n ?? 0 } });
}
