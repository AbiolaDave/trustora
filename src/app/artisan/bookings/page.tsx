import type { Metadata } from "next";
import { connectDb } from "../../../lib/db";
import { requireArtisan } from "../../../lib/auth/server";
import { Booking } from "../../../models/booking";
import { BookingList } from "../../../components/booking-list";
import { Flash, PageHeader } from "../../../components/ui";
import { first } from "../../../lib/validation";

export const metadata: Metadata = { title: "Bookings" };
export const dynamic = "force-dynamic";

export default async function ArtisanBookings({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; const { profile } = await requireArtisan(); await connectDb();
  const bookings = profile ? await Booking.find({ artisan: profile._id }).sort({ createdAt: -1 }).limit(100).lean() : [];
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Bookings" intro="Requests, quotes and jobs, newest first." />
    <BookingList bookings={bookings as never} base="/artisan/bookings" emptyTitle="No bookings yet" emptyBody="Finish your profile, add a service and set your hours to start receiving requests." /></>);
}
