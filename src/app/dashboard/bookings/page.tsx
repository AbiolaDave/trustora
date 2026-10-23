import type { Metadata } from "next";
import { connectDb } from "../../../lib/db";
import { requireUser } from "../../../lib/auth/server";
import { Booking } from "../../../models/booking";
import { BookingList } from "../../../components/booking-list";
import { Flash, PageHeader } from "../../../components/ui";
import { first } from "../../../lib/validation";

export const metadata: Metadata = { title: "Your bookings" };
export const dynamic = "force-dynamic";

export default async function Bookings({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; const user = await requireUser(["customer"]); await connectDb();
  const bookings = await Booking.find({ customer: user._id }).sort({ createdAt: -1 }).limit(100).lean();
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Bookings" intro="Every booking you've made, newest first." />
    <BookingList bookings={bookings as never} base="/dashboard/bookings" emptyTitle="No bookings yet" emptyBody="Find an artisan and send your first request." /></>);
}
