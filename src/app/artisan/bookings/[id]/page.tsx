import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { requireUser } from "../../../../lib/auth/server";
import { getBookingFor } from "../../../../server/booking/access";
import { BookingDetail } from "../../../../components/booking-detail";
import { Flash } from "../../../../components/ui";
import { first } from "../../../../lib/validation";

export const metadata: Metadata = { title: "Booking" };
export const dynamic = "force-dynamic";

export default async function ArtisanBooking({ params, searchParams }: { params: Promise<{ id: string }>; searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const [{ id }, sp, user] = await Promise.all([params, searchParams, requireUser(["artisan"])]);
  const b = await getBookingFor(user._id, "artisan", id);
  if (!b) notFound();
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><BookingDetail b={b} side="artisan" /></>);
}
