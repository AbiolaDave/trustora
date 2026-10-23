import Link from "next/link";
import type { Metadata } from "next";
import { connectDb } from "@/lib/db";
import { requireUser } from "@/lib/auth/server";
import { Payment } from "@/models/payment";
import { Booking } from "@/models/booking";
import { EmptyState, Money, PageHeader, dateTime } from "@/components/ui";

export const metadata: Metadata = { title: "Payment history" };
export const dynamic = "force-dynamic";

export default async function Payments() {
  const user = await requireUser(["customer"]); await connectDb();
  const pays = await Payment.find({ customer: user._id, status: "success" }).sort({ paidAt: -1 }).limit(100).lean();
  const bookings = new Map((await Booking.find({ _id: { $in: pays.map((p) => p.booking) } }).select("serviceTitle reference").lean()).map((b) => [String(b._id), b]));
  return (<><PageHeader title="Payment history" intro="Receipts for everything you've paid." />
    {pays.length === 0 ? <EmptyState title="No payments yet" body="Completed payments and refunds will be listed here." /> : (
      <div className="table-wrap"><table><thead><tr><th>Date</th><th>For</th><th>Reference</th><th>Amount</th><th>Refunded</th></tr></thead><tbody>
        {pays.map((p) => { const b = bookings.get(String(p.booking)); const refunded = p.refunds.reduce((n, r) => (r.status === "failed" ? n : n + (r.amountKobo ?? 0)), 0);
          return <tr key={String(p._id)}><td>{p.paidAt ? dateTime(p.paidAt) : "-"}</td><td><Link className="underline" href={`/dashboard/bookings/${p.booking}`}>{b?.serviceTitle ?? "Booking"}</Link></td><td className="text-xs">{p.reference}</td><td><Money kobo={p.amountKobo} /></td><td>{refunded ? <Money kobo={refunded} /> : "-"}</td></tr>; })}
      </tbody></table></div>)}</>);
}
