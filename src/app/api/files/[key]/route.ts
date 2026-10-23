import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/server";
import { connectDb } from "@/lib/db";
import { readPrivateFile } from "@/lib/storage";
import { ArtisanProfile } from "@/models/artisan-profile";
import { Booking } from "@/models/booking";

export const dynamic = "force-dynamic";

/** Private files: ID documents (owner + admins) and job photos (the two parties + admins). Anyone else gets 404. */
export async function GET(_req: Request, ctx: { params: Promise<{ key: string }> }) {
  const { key } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return new NextResponse("Not found", { status: 404 });
  await connectDb();
  let allowed = user.role === "admin";
  if (!allowed) {
    const mine = await ArtisanProfile.findOne({ user: user._id }).select("_id verificationDocs").lean();
    if (mine?.verificationDocs?.some((d) => d.storageKey === key)) allowed = true;
    const booking = await Booking.findOne({ mediaKeys: key }).select("customer artisan").lean();
    if (booking && (booking.customer.equals(user._id) || (mine && booking.artisan.equals(mine._id)))) allowed = true;
  }
  if (!allowed) return new NextResponse("Not found", { status: 404 });
  const f = await readPrivateFile(key);
  if (!f) return new NextResponse("Not found", { status: 404 });
  return new NextResponse(new Uint8Array(f.data), { headers: { "Content-Type": f.type, "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
}
