import { connectDb } from "../../lib/db";
import { objectId } from "../../lib/validation";
import { Booking } from "../../models/booking";
import { ArtisanProfile } from "../../models/artisan-profile";

/** Returns the booking only if this user is its customer (side "customer") or its artisan (side "artisan"). Otherwise null. */
export async function getBookingFor(userId: unknown, side: "customer" | "artisan", id: string) {
  if (!objectId.safeParse(id).success) return null;
  await connectDb();
  const b = await Booking.findById(id).lean();
  if (!b) return null;
  if (side === "customer") return String(b.customer) === String(userId) ? b : null;
  const p = await ArtisanProfile.findOne({ user: userId }).select("_id").lean();
  return p && String(b.artisan) === String(p._id) ? b : null;
}
