import Link from "next/link";
import type { Metadata } from "next";
import { connectDb } from "@/lib/db";
import { requireArtisan } from "@/lib/auth/server";
import { Booking } from "@/models/booking";
import { BookingList } from "@/components/booking-list";
import { Flash, PageHeader, Rating, VerifiedBadge } from "@/components/ui";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Artisan dashboard" };
export const dynamic = "force-dynamic";

export default async function ArtisanHome({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; const { profile } = await requireArtisan(); await connectDb();
  if (!profile) return <Flash error="Your profile is missing. Contact support." />;
  const [requests, upcoming] = await Promise.all([
    Booking.find({ artisan: profile._id, status: "pending_artisan_response" }).sort({ expiresAt: 1 }).lean(),
    Booking.find({ artisan: profile._id, status: { $in: ["awaiting_customer_approval", "awaiting_payment", "confirmed", "in_progress"] } }).sort({ startsAt: 1 }).limit(10).lean(),
  ]);
  return (
    <>
      <Flash ok={first(sp.ok)} error={first(sp.error)} />
      <PageHeader title={profile.displayName}><Link className="btn btn-ghost btn-sm" href={`/artisans/${profile.slug}`}>View public profile</Link></PageHeader>
      <div className="mb-6 flex flex-wrap items-center gap-3"><VerifiedBadge status={profile.verificationStatus} /><Rating avg={profile.ratingAvg ?? 0} count={profile.ratingCount ?? 0} />{profile.paused && <span className="rounded-full bg-sun-100 px-2.5 py-0.5 text-xs font-semibold text-sun-700">Paused: not accepting new bookings</span>}</div>
      <h2 className="mb-3 text-xl font-bold">Booking requests {requests.length > 0 && <span className="text-pepper-600">({requests.length})</span>}</h2>
      <BookingList bookings={requests as never} base="/artisan/bookings" emptyTitle="No new requests" emptyBody="New requests appear here. Respond quickly: they expire after 12 hours." />
      <h2 className="mb-3 mt-8 text-xl font-bold">Upcoming jobs</h2>
      <BookingList bookings={upcoming as never} base="/artisan/bookings" emptyTitle="No upcoming jobs" emptyBody="Confirmed and in-progress jobs will be listed here." />
    </>
  );
}
