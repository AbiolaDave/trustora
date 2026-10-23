import Link from "next/link";
import type { Metadata } from "next";
import { connectDb } from "../../lib/db";
import { requireUser } from "../../lib/auth/server";
import { Booking } from "../../models/booking";
import { Notification } from "../../models/misc";
import { BookingList } from "../../components/booking-list";
import { Flash, PageHeader } from "../../components/ui";
import { first } from "../../lib/validation";

export const metadata: Metadata = { title: "Your dashboard" };
export const dynamic = "force-dynamic";

export default async function Overview({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const user = await requireUser(["customer"]);
  await connectDb();
  const [upcoming, needsAction, unread] = await Promise.all([
    Booking.find({
      customer: user._id,
      status: {
        $in: [
          "pending_artisan_response",
          "awaiting_customer_approval",
          "awaiting_payment",
          "confirmed",
          "in_progress",
        ],
      },
    })
      .sort({ startsAt: 1 })
      .limit(5)
      .lean(),
    Booking.countDocuments({
      customer: user._id,
      status: { $in: ["awaiting_customer_approval", "awaiting_payment"] },
    }),
    Notification.countDocuments({ user: user._id, readAt: { $exists: false } }),
  ]);
  return (
    <>
      <Flash ok={first(sp.ok)} error={first(sp.error)} />
      <PageHeader title={`Hello, ${user.name.split(" ")[0]}`}>
        <Link href="/services" className="btn btn-primary">
          Find a service
        </Link>
      </PageHeader>
      {needsAction > 0 && (
        <p className="mb-4 rounded-lg bg-sun-100 p-3 text-sun-700">
          <strong>{needsAction}</strong>{" "}
          {needsAction === 1 ? "booking needs" : "bookings need"} your attention
          (a quote to approve or a payment to make).
        </p>
      )}
      <h2 className="mb-3 text-xl font-bold">Upcoming and active</h2>
      <BookingList
        bookings={upcoming as never}
        base="/dashboard/bookings"
        emptyTitle="No active bookings"
        emptyBody="When you book a service it will show up here, with its status."
      />
      {unread > 0 && (
        <p className="mt-6 text-sm">
          <Link href="/dashboard/notifications" className="underline">
            You have {unread} unread{" "}
            {unread === 1 ? "notification" : "notifications"}
          </Link>
        </p>
      )}
    </>
  );
}
