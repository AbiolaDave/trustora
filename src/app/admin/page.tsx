import type { Metadata } from "next";
import { connectDb } from "@/lib/db";
import { User } from "@/models/user";
import { ArtisanProfile } from "@/models/artisan-profile";
import { Booking } from "@/models/booking";
import { Payment } from "@/models/payment";
import { Dispute, Payout } from "@/models/misc";
import { Flash, Money, PageHeader } from "@/components/ui";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Admin overview" };
export const dynamic = "force-dynamic";
const ymd = (d: Date) => d.toISOString().slice(0, 10);
const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : "n/a");

function Stat({ label, value, def }: { label: string; value: React.ReactNode; def: string }) {
  return <div className="panel"><p className="text-sm font-semibold text-ink-700">{label}</p><p className="font-display text-2xl font-bold">{value}</p><p className="mt-1 text-xs text-ink-500">{def}</p></div>;
}

export default async function AdminHome({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; await connectDb();
  const toD = /^\d{4}-\d{2}-\d{2}$/.test(first(sp.to) ?? "") ? new Date(`${first(sp.to)}T23:59:59.999Z`) : new Date();
  const fromD = /^\d{4}-\d{2}-\d{2}$/.test(first(sp.from) ?? "") ? new Date(`${first(sp.from)}T00:00:00Z`) : new Date(toD.getTime() - 30 * 86_400_000);
  const range = { $gte: fromD, $lte: toD };
  const [customers, artisans, verified, requests, paidBookings, completed, cancelled, disputes, gross, revenueAgg, refundAgg, owed, topServices, topAreas, repeat, pending, openDisputes] = await Promise.all([
    User.countDocuments({ role: "customer" }), ArtisanProfile.countDocuments(), ArtisanProfile.countDocuments({ verificationStatus: "verified" }),
    Booking.countDocuments({ createdAt: range }),
    Payment.countDocuments({ status: "success", paidAt: range }),
    Booking.countDocuments({ status: "completed", completedAt: range }),
    Booking.countDocuments({ status: "cancelled", updatedAt: range }),
    Dispute.countDocuments({ createdAt: range }),
    Payment.aggregate([{ $match: { status: "success", paidAt: range } }, { $group: { _id: null, t: { $sum: "$amountKobo" } } }]),
    Booking.aggregate([{ $match: { status: "completed", completedAt: range } }, { $group: { _id: null, t: { $sum: "$pricing.platformRevenueKobo" } } }]),
    Payment.aggregate([{ $unwind: "$refunds" }, { $match: { "refunds.status": { $ne: "failed" }, "refunds.at": range } }, { $group: { _id: null, t: { $sum: "$refunds.amountKobo" } } }]),
    Payout.aggregate([{ $match: { status: { $in: ["due", "withheld"] } } }, { $group: { _id: null, t: { $sum: "$amountKobo" } } }]),
    Booking.aggregate([{ $match: { createdAt: range } }, { $group: { _id: "$serviceTitle", n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 5 }]),
    Booking.aggregate([{ $match: { createdAt: range } }, { $group: { _id: { $toLower: "$address.area" }, n: { $sum: 1 } } }, { $sort: { n: -1 } }, { $limit: 5 }]),
    Booking.aggregate([{ $match: { createdAt: range } }, { $group: { _id: "$customer", n: { $sum: 1 } } }, { $group: { _id: null, all: { $sum: 1 }, repeat: { $sum: { $cond: [{ $gte: ["$n", 2] }, 1, 0] } } } }]),
    ArtisanProfile.countDocuments({ verificationStatus: "pending_review" }), Dispute.countDocuments({ status: "open" }),
  ]);
  const t = (a: { t: number }[]) => a[0]?.t ?? 0;
  return (
    <>
      <Flash ok={first(sp.ok)} error={first(sp.error)} />
      <PageHeader title="Marketplace overview" intro="Real numbers from the database. Nothing is estimated or pre-filled." />
      <form className="mb-6 flex flex-wrap items-end gap-3"><div><label className="label" htmlFor="from">From</label><input id="from" type="date" name="from" defaultValue={ymd(fromD)} className="input" /></div><div><label className="label" htmlFor="to">To</label><input id="to" type="date" name="to" defaultValue={ymd(toD)} className="input" /></div><button className="btn btn-ghost">Apply</button></form>
      {(pending > 0 || openDisputes > 0) && <p className="mb-4 rounded-lg bg-sun-100 p-3 text-sun-700">{pending > 0 && <><strong>{pending}</strong> verification {pending === 1 ? "application" : "applications"} waiting. </>}{openDisputes > 0 && <><strong>{openDisputes}</strong> open {openDisputes === 1 ? "dispute" : "disputes"}.</>}</p>}
      <h2 className="mb-2 text-xl font-bold">People (all time)</h2>
      <div className="grid gap-3 sm:grid-cols-3"><Stat label="Customers" value={customers} def="Registered customer accounts." /><Stat label="Artisans" value={artisans} def="Registered artisan accounts." /><Stat label="Verified artisans" value={verified} def="Artisans whose documents an admin approved." /></div>
      <h2 className="mb-2 mt-8 text-xl font-bold">Bookings (selected dates)</h2>
      <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
        <Stat label="Booking requests" value={requests} def="Bookings created in the range." />
        <Stat label="Paid bookings" value={paidBookings} def="Bookings with a verified payment in the range." />
        <Stat label="Completion rate" value={pct(completed, paidBookings)} def="Completed ÷ paid bookings in the range." />
        <Stat label="Cancellation rate" value={pct(cancelled, requests)} def="Cancelled ÷ requests in the range." />
        <Stat label="Dispute rate" value={pct(disputes, paidBookings)} def="Problem reports ÷ paid bookings." />
        <Stat label="Returning customers" value={pct(repeat[0]?.repeat ?? 0, repeat[0]?.all ?? 0)} def="Customers with 2+ requests ÷ customers with any." /></div>
      <h2 className="mb-2 mt-8 text-xl font-bold">Money</h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Gross booking value" value={<Money kobo={t(gross)} />} def="Customer payments verified in the range. Includes money owed to artisans." />
        <Stat label="Platform revenue" value={<Money kobo={t(revenueAgg)} />} def="Commission + customer fees on jobs completed in the range." />
        <Stat label="Refunds" value={<Money kobo={t(refundAgg)} />} def="Refunds issued in the range." />
        <Stat label="Owed to artisans" value={<Money kobo={t(owed)} />} def="Payouts due or on hold, all time. Not our revenue." /></div>
      <div className="mt-8 grid gap-6 md:grid-cols-2">
        <div><h2 className="mb-2 text-xl font-bold">Most requested services</h2>{topServices.length ? <ol className="panel list-decimal space-y-1 pl-9">{topServices.map((s) => <li key={s._id}>{s._id} <span className="text-ink-500">({s.n})</span></li>)}</ol> : <p className="text-ink-500">No bookings in this range.</p>}</div>
        <div><h2 className="mb-2 text-xl font-bold">Where demand is</h2>{topAreas.length ? <ol className="panel list-decimal space-y-1 pl-9">{topAreas.map((s) => <li key={s._id} className="capitalize">{s._id} <span className="text-ink-500">({s.n})</span></li>)}</ol> : <p className="text-ink-500">No bookings in this range.</p>}</div></div>
    </>
  );
}
