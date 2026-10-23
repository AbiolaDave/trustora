import type { Metadata } from "next";
import Link from "next/link";
import { connectDb } from "@/lib/db";
import { Dispute } from "@/models/misc";
import { Booking } from "@/models/booking";
import { ArtisanProfile } from "@/models/artisan-profile";
import { User } from "@/models/user";
import { resolveDisputeAction } from "@/server/actions/admin";
import { EmptyState, Flash, Money, PageHeader, StatusPill, TextArea, dateTime } from "@/components/ui";
import { first } from "@/lib/validation";

export const metadata: Metadata = { title: "Disputes" };
export const dynamic = "force-dynamic";
const R: Record<string, string> = { no_show: "Artisan didn't show up", incomplete_work: "Incomplete work", poor_quality: "Poor quality", price_mismatch: "Price mismatch", customer_refused_to_pay: "Customer refused to pay", other: "Other" };

export default async function Disputes({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams; await connectDb();
  const all = first(sp.show) === "all";
  const disputes = await Dispute.find(all ? {} : { status: "open" }).sort({ createdAt: 1 }).limit(50).lean();
  const bookings = new Map((await Booking.find({ _id: { $in: disputes.map((d) => d.booking) } }).lean()).map((b) => [String(b._id), b]));
  const artisans = new Map((await ArtisanProfile.find({ _id: { $in: [...bookings.values()].map((b) => b.artisan) } }).select("displayName").lean()).map((a) => [String(a._id), a.displayName]));
  const customers = new Map((await User.find({ _id: { $in: [...bookings.values()].map((b) => b.customer) } }).select("name").lean()).map((u) => [String(u._id), u.name]));
  return (<><Flash ok={first(sp.ok)} error={first(sp.error)} /><PageHeader title="Disputes" intro="Read both sides, check the booking record, then decide. Your decision and note are logged."><Link className="btn btn-ghost btn-sm" href={all ? "/admin/disputes" : "/admin/disputes?show=all"}>{all ? "Show open only" : "Show resolved too"}</Link></PageHeader>
    {disputes.length === 0 ? <EmptyState title="No disputes" body="Reported problems appear here." /> : (
      <ul className="space-y-5">{disputes.map((d) => { const b = bookings.get(String(d.booking)); return (
        <li key={String(d._id)} className="panel space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-display text-lg font-bold">{R[d.reason]} · {b?.serviceTitle}</p>{b && <StatusPill status={b.status} />}</div>
          {b && <p className="text-sm text-ink-500">{b.reference} · {customers.get(String(b.customer))} with {artisans.get(String(b.artisan))} · {dateTime(b.startsAt)} · paid <Money kobo={b.paymentStatus === "unpaid" ? 0 : b.pricing?.totalKobo} /></p>}
          <ul className="space-y-2">{d.statements.map((s, i) => <li key={i} className="rounded-lg bg-ink-50 p-3 text-[15px]"><strong className="capitalize">{s.role}</strong> <span className="text-xs text-ink-500">{dateTime(s.at)}</span><p className="mt-1 whitespace-pre-line">{s.text}</p></li>)}</ul>
          {d.status === "open" ? (
            <form action={resolveDisputeAction} className="space-y-3 border-t border-ink-100 pt-3"><input type="hidden" name="disputeId" value={String(d._id)} />
              <div><label className="label" htmlFor={`res${d._id}`}>Decision</label><select id={`res${d._id}`} name="resolution" className="input" required defaultValue=""><option value="" disabled>Choose…</option><option value="refund_customer">Refund the customer in full (booking cancelled)</option><option value="release_to_artisan">Release to the artisan (job complete, payout due)</option></select></div>
              <TextArea label="Note explaining your decision (both parties will see it)" name="note" required /><button className="btn btn-primary">Record decision</button></form>
          ) : <p className="rounded-lg bg-leaf-50 p-3 text-[15px] text-leaf-700">Resolved: {d.resolution === "refund_customer" ? "customer refunded" : "released to artisan"}. {d.resolutionNote}</p>}
        </li>); })}</ul>)}</>);
}
