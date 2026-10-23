import type { Metadata } from "next";
import { connectDb } from "@/lib/db";
import { Booking, BOOKING_STATES_FOR_FILTER } from "@/models/booking";
import { ArtisanProfile } from "@/models/artisan-profile";
import { User } from "@/models/user";
import { Flash, Money, PageHeader, StatusPill, dateTime, statusLabel } from "@/components/ui";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "All bookings" };
export const dynamic = "force-dynamic";

export default async function AdminBookings({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; await connectDb();
  const status = first(sp.status);
  const bookings = await Booking.find(status && BOOKING_STATES_FOR_FILTER.includes(status) ? { status } : {}).sort({ createdAt: -1 }).limit(100).lean();
  const artisans = new Map((await ArtisanProfile.find({ _id: { $in: bookings.map((b) => b.artisan) } }).select("displayName").lean()).map((a) => [String(a._id), a.displayName]));
  const customers = new Map((await User.find({ _id: { $in: bookings.map((b) => b.customer) } }).select("name").lean()).map((u) => [String(u._id), u.name]));
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Bookings" />
    <form className="mb-4 flex gap-2"><select name="status" defaultValue={status ?? ""} className="input max-w-xs" aria-label="Status"><option value="">All statuses</option>{BOOKING_STATES_FOR_FILTER.map((s) => <option key={s} value={s}>{statusLabel(s)}</option>)}</select><button className="btn btn-ghost">Filter</button></form>
    <div className="table-wrap"><table><thead><tr><th>Ref</th><th>Service</th><th>Customer</th><th>Artisan</th><th>When</th><th>Total</th><th>Status</th></tr></thead><tbody>
      {bookings.map((b) => <tr key={String(b._id)}><td className="text-xs">{b.reference}</td><td>{b.serviceTitle}</td><td>{customers.get(String(b.customer))}</td><td>{artisans.get(String(b.artisan))}</td><td>{dateTime(b.startsAt)}</td><td><Money kobo={b.pricing?.totalKobo} /><br /><span className="text-xs text-ink-500">{b.paymentStatus}</span></td><td><StatusPill status={b.status} /></td></tr>)}</tbody></table></div></>);
}
